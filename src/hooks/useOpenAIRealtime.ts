import { useState, useEffect, useRef, useCallback } from "react";

interface Message {
  id: string;
  type: "interviewer" | "user";
  text: string;
  timestamp: Date;
}

interface RealtimeSession {
  isConnected: boolean;
  isInterviewerSpeaking: boolean;
  messages: Message[];
  currentQuestion: string | null;
  questionNumber: number;
  totalQuestions: number;
  error: string | null;
}

export function useOpenAIRealtime() {
  const [session, setSession] = useState<RealtimeSession>({
    isConnected: false,
    isInterviewerSpeaking: false,
    messages: [],
    currentQuestion: null,
    questionNumber: 0,
    totalQuestions: 5,
    error: null,
  });
  const [isLoading, setIsLoading] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const partialTextRef = useRef<string>("");
  const audioQueueRef = useRef<AudioBuffer[]>([]);
  const isPlayingRef = useRef<boolean>(false);

  const playNextAudioChunk = useCallback(() => {
    if (!audioContextRef.current || isPlayingRef.current || audioQueueRef.current.length === 0) {
      return;
    }

    if (audioContextRef.current.state === "suspended") {
      audioContextRef.current.resume();
    }

    const audioBuffer = audioQueueRef.current.shift();
    if (!audioBuffer) return;

    try {
      isPlayingRef.current = true;
      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContextRef.current.destination);
      
      source.onended = () => {
        isPlayingRef.current = false;
        if (audioQueueRef.current.length > 0) {
          playNextAudioChunk();
        } else {
          setSession((prev) => ({ ...prev, isInterviewerSpeaking: false }));
        }
      };
      
      source.start();
    } catch (err) {
      isPlayingRef.current = false;
      console.error("Audio playback error:", err);
    }
  }, []);

  const connect = useCallback(async () => {
    setIsLoading(true);
    setSession((prev) => ({ ...prev, error: null }));

    try {
      const wsUrl = `ws://localhost:8000/api/realtime/ws`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(JSON.stringify({
          type: "session.update",
          session: {
            modalities: ["text", "audio"],
            instructions: "You are a professional interview coach conducting a technical interview. Start by greeting the candidate warmly and asking the first interview question. Keep questions concise and professional.",
            voice: "alloy",
            input_audio_format: "pcm16",
            output_audio_format: "pcm16",
            input_audio_transcription: {
              model: "whisper-1"
            },
            turn_detection: {
              type: "server_vad",
              threshold: 0.5,
              prefix_padding_ms: 300,
              silence_duration_ms: 500
            }
          }
        }));

        setSession((prev) => ({ ...prev, isConnected: true, questionNumber: 1 }));
        setIsLoading(false);

        setTimeout(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              type: "response.create",
              response: {
                modalities: ["text", "audio"]
              }
            }));
          }
        }, 1000);
      };

      ws.onmessage = (event) => {
          const data = JSON.parse(event.data);
          
          if (data.type === "response.audio.delta" && data.delta) {
            setSession((prev) => ({ ...prev, isInterviewerSpeaking: true }));
            if (audioContextRef.current && audioContextRef.current.state !== "closed") {
              try {
                const audioData = atob(data.delta);
                const samples = audioData.length / 2;
                if (samples > 0) {
                  const audioBuffer = audioContextRef.current.createBuffer(1, samples, 16000);
                  const channelData = audioBuffer.getChannelData(0);
                  for (let i = 0; i < samples; i++) {
                    const byte1 = audioData.charCodeAt(i * 2);
                    const byte2 = audioData.charCodeAt(i * 2 + 1);
                    const sample = ((byte2 << 8) | byte1);
                    const signedSample = sample > 32767 ? sample - 65536 : sample;
                    channelData[i] = signedSample / 32768;
                  }
                  audioQueueRef.current.push(audioBuffer);
                  playNextAudioChunk();
                }
              } catch (err) {
                console.error("Audio processing error:", err);
              }
            }
          }

          if (data.type === "response.create") {
            setSession((prev) => ({ ...prev, isInterviewerSpeaking: true }));
          }

          if (data.type === "response.audio.done") {
            setSession((prev) => ({ ...prev, isInterviewerSpeaking: false }));
            isPlayingRef.current = false;
          }

          if (data.type === "response.done") {
            setSession((prev) => ({ ...prev, isInterviewerSpeaking: false }));
            isPlayingRef.current = false;
          }

          if (data.type === "response.text.delta" && data.delta) {
            partialTextRef.current += data.delta;
          }

          if (data.type === "response.text.done") {
            const questionText = partialTextRef.current.trim();
            if (questionText) {
              setSession((prev) => ({
                ...prev,
                currentQuestion: questionText,
                messages: [
                  ...prev.messages,
                  {
                    id: Date.now().toString(),
                    type: "interviewer",
                    text: questionText,
                    timestamp: new Date(),
                  },
                ],
                questionNumber: prev.questionNumber + 1,
              }));
              partialTextRef.current = "";
            }
          }

          if (data.type === "conversation.item.input_audio_transcription.completed") {
            const userText = data.transcript;
            if (userText) {
              setSession((prev) => ({
                ...prev,
                messages: [
                  ...prev.messages,
                  {
                    id: Date.now().toString(),
                    type: "user",
                    text: userText,
                    timestamp: new Date(),
                  },
                ],
              }));
            }
          }

          if (data.type === "error") {
            setSession((prev) => ({ ...prev, error: data.error?.message || "Unknown error" }));
          }
      };

      ws.onerror = (error) => {
        setSession((prev) => ({ ...prev, error: "WebSocket connection error", isConnected: false }));
        setIsLoading(false);
      };

      ws.onclose = (event) => {
        setSession((prev) => ({ 
          ...prev, 
          isConnected: false,
          error: event.code !== 1000 && event.code !== 1001 
            ? (event.reason || `Connection closed (code: ${event.code})`) 
            : null
        }));
        setIsLoading(false);
      };

      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext({ sampleRate: 16000 });
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaStreamRef.current = stream;
        const audioContext = audioContextRef.current;
        
        if (audioContext.state === "suspended") {
          await audioContext.resume();
        }
        
        const source = audioContext.createMediaStreamSource(stream);
        const processor = audioContext.createScriptProcessor(4096, 1, 1);

        processor.onaudioprocess = (e) => {
          if (ws.readyState === WebSocket.OPEN) {
            const inputData = e.inputBuffer.getChannelData(0);
            const pcm16 = new Int16Array(inputData.length);
            for (let i = 0; i < inputData.length; i++) {
              pcm16[i] = Math.max(-32768, Math.min(32767, inputData[i] * 32768));
            }
            const base64 = btoa(String.fromCharCode(...new Uint8Array(pcm16.buffer)));
            ws.send(JSON.stringify({
              type: "input_audio_buffer.append",
              audio: base64,
            }));
          }
        };

        source.connect(processor);
        processor.connect(audioContext.destination);
      } catch (mediaErr) {
        if (mediaErr instanceof DOMException) {
          if (mediaErr.name === "NotAllowedError" || mediaErr.name === "PermissionDeniedError") {
            setSession((prev) => ({
              ...prev,
              error: "Microphone permission denied. Please allow microphone access and try again.",
              isConnected: false,
            }));
          } else if (mediaErr.name === "NotFoundError" || mediaErr.name === "DevicesNotFoundError") {
            setSession((prev) => ({
              ...prev,
              error: "No microphone found. Please connect a microphone and try again.",
              isConnected: false,
            }));
          } else {
            setSession((prev) => ({
              ...prev,
              error: `Microphone error: ${mediaErr.message}`,
              isConnected: false,
            }));
          }
        } else {
          setSession((prev) => ({
            ...prev,
            error: mediaErr instanceof Error ? mediaErr.message : "Failed to access microphone",
            isConnected: false,
          }));
        }
        setIsLoading(false);
        if (wsRef.current) {
          wsRef.current.close();
        }
      }
    } catch (err) {
      setSession((prev) => ({
        ...prev,
        error: err instanceof Error ? err.message : "Failed to connect",
        isConnected: false,
      }));
      setIsLoading(false);
    }
  }, [playNextAudioChunk]);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    audioQueueRef.current = [];
    isPlayingRef.current = false;
    setSession({
      isConnected: false,
      isInterviewerSpeaking: false,
      messages: [],
      currentQuestion: null,
      questionNumber: 0,
      totalQuestions: 5,
      error: null,
    });
  }, []);

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    session,
    isLoading,
    connect,
    disconnect,
  };
}

