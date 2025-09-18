import { useEffect, useRef, useState, useCallback } from "react";
import * as SpeechSDK from "microsoft-cognitiveservices-speech-sdk";

const getEnv = (k) =>
  (typeof import.meta !== "undefined" ? import.meta.env?.[k] : undefined) ||
  process.env[k];

export default function useAzureSpeech({
  language = "en-US",
  enablePunctuation = true,
} = {}) {
  const subscriptionKey =
    getEnv("VITE_AZURE_SPEECH_KEY") || getEnv("REACT_APP_AZURE_SPEECH_KEY");
  const region =
    getEnv("VITE_AZURE_SPEECH_REGION") ||
    getEnv("REACT_APP_AZURE_SPEECH_REGION");

  const recognizerRef = useRef(null);
  const [partial, setPartial] = useState(null);
  const [finals, setFinals] = useState([]); // {text, offsetMs, durationMs}
  const [isListening, setListening] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!subscriptionKey || !region) {
      setError("Missing Azure Speech key/region env vars.");
      return;
    }
    try {
      const speechConfig = SpeechSDK.SpeechConfig.fromSubscription(
        subscriptionKey,
        region
      );
      speechConfig.speechRecognitionLanguage = language;
      speechConfig.enableDictation();
      if (enablePunctuation)
        speechConfig.setProperty(
          "SpeechServiceResponse_PostProcessingOption",
          "TrueText"
        );

      const audioConfig = SpeechSDK.AudioConfig.fromDefaultMicrophoneInput();
      const recognizer = new SpeechSDK.SpeechRecognizer(
        speechConfig,
        audioConfig
      );

      recognizer.recognizing = (_, e) => {
        if (e?.result?.text) {
          setPartial({
            text: e.result.text,
            offsetMs: e.result.offset / 10000,
          });
        }
      };

      recognizer.recognized = (_, e) => {
        if (e?.result?.text) {
          setPartial(null);
          setFinals((p) => [
            ...p,
            {
              text: e.result.text,
              offsetMs: e.result.offset / 10000,
              durationMs: e.result.duration / 10000,
            },
          ]);
        }
      };

      recognizer.canceled = (_, e) => {
        setError(e?.errorDetails || "Speech canceled");
        setListening(false);
      };
      recognizer.sessionStopped = () => setListening(false);

      recognizerRef.current = recognizer;
      setReady(true);
      return () => {
        recognizer.close();
        recognizerRef.current = null;
      };
    } catch (err) {
      setError(String(err?.message || err));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subscriptionKey, region, language, enablePunctuation]);

  const startListening = useCallback(() => {
    if (!recognizerRef.current || isListening) return;
    setError(null);
    recognizerRef.current.startContinuousRecognitionAsync();
    setListening(true);
  }, [isListening]);

  const stopListening = useCallback(() => {
    if (!recognizerRef.current || !isListening) return;
    recognizerRef.current.stopContinuousRecognitionAsync();
    setListening(false);
  }, [isListening]);

  const reset = useCallback(() => {
    setPartial(null);
    setFinals([]);
    setError(null);
  }, []);

  return { 
    ready, 
    isListening, 
    partial, 
    finals, 
    error, 
    startListening, 
    stopListening, 
    reset 
  };
}