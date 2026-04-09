import { useCallback, useEffect, useRef, useState } from "react";
import { calculateRmsFromFloat32Array } from "../utils/browserVad";

export default function useVAD({
  threshold = 0.02,
  silenceMs = 500,
  rambleThresholdMs = 180000,
  onSpeechStart,
  onSpeechEnd,
  onBargeIn,
  onRambleThreshold,
  shouldBargeIn,
} = {}) {
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceRef = useRef(null);
  const intervalRef = useRef(null);
  const isRunningRef = useRef(false);
  const isSpeakingRef = useRef(false);
  const speechStartedAtRef = useRef(0);
  const lastAboveThresholdAtRef = useRef(0);
  const rambleNotifiedRef = useRef(false);
  const [level, setLevel] = useState(0);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [supported, setSupported] = useState(true);

  const stop = useCallback(() => {
    isRunningRef.current = false;
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (sourceRef.current) {
      try {
        sourceRef.current.disconnect();
      } catch {
        // no-op
      }
      sourceRef.current = null;
    }
    if (analyserRef.current) {
      try {
        analyserRef.current.disconnect();
      } catch {
        // no-op
      }
      analyserRef.current = null;
    }
    if (audioContextRef.current) {
      try {
        audioContextRef.current.close();
      } catch {
        // no-op
      }
      audioContextRef.current = null;
    }
    isSpeakingRef.current = false;
    rambleNotifiedRef.current = false;
    setIsSpeaking(false);
    setLevel(0);
  }, []);

  const start = useCallback(async (stream) => {
    if (isRunningRef.current || !stream || typeof window === "undefined") {
      return false;
    }

    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextCtor) {
      setSupported(false);
      return false;
    }

    try {
      const audioContext = new AudioContextCtor();
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.2;
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      sourceRef.current = source;
      isRunningRef.current = true;
      setSupported(true);

      const samples = new Float32Array(analyser.fftSize);

      intervalRef.current = setInterval(() => {
        if (!analyserRef.current || !isRunningRef.current) {
          return;
        }
        analyserRef.current.getFloatTimeDomainData(samples);
        const rms = calculateRmsFromFloat32Array(samples);
        const speakingNow = rms >= threshold;
        const now = Date.now();
        setLevel(Number(rms.toFixed(4)));

        if (speakingNow) {
          lastAboveThresholdAtRef.current = now;
          if (!isSpeakingRef.current) {
            isSpeakingRef.current = true;
            speechStartedAtRef.current = now;
            rambleNotifiedRef.current = false;
            setIsSpeaking(true);
            if (typeof onSpeechStart === "function") {
              onSpeechStart({ level: rms, startedAt: now });
            }
            if (typeof shouldBargeIn === "function" && shouldBargeIn()) {
              onBargeIn?.({ reason: "barge_in", level: rms, startedAt: now });
            }
          } else if (
            !rambleNotifiedRef.current &&
            rambleThresholdMs > 0 &&
            now - speechStartedAtRef.current >= rambleThresholdMs
          ) {
            rambleNotifiedRef.current = true;
            onRambleThreshold?.({
              reason: "ramble_threshold",
              level: rms,
              durationMs: now - speechStartedAtRef.current,
            });
          }
        } else if (isSpeakingRef.current && now - lastAboveThresholdAtRef.current >= silenceMs) {
          isSpeakingRef.current = false;
          setIsSpeaking(false);
          if (typeof onSpeechEnd === "function") {
            onSpeechEnd({
              endedAt: now,
              durationMs: now - speechStartedAtRef.current,
            });
          }
        }
      }, 80);

      return true;
    } catch {
      stop();
      setSupported(false);
      return false;
    }
  }, [onBargeIn, onRambleThreshold, onSpeechEnd, onSpeechStart, shouldBargeIn, silenceMs, stop, threshold, rambleThresholdMs]);

  useEffect(() => () => stop(), [stop]);

  return {
    supported,
    isSpeaking,
    level,
    start,
    stop,
  };
}

