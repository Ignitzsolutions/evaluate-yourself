import { useEffect, useRef, useState, useCallback } from "react";

export default function useBrowserSpeechRecognition({
  language = "en-US",
  interimResults = true,
} = {}) {
  const recognizerRef = useRef(null);
  const [partial, setPartial] = useState(null);
  const [finals, setFinals] = useState([]);
  const [isListening, setListening] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const Recognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      setError("Web Speech API is not supported in this browser.");
      return;
    }

    try {
      const recognizer = new Recognition();
      recognizer.lang = language;
      recognizer.continuous = true;
      recognizer.interimResults = interimResults;
      recognizer.maxAlternatives = 1;

      recognizer.onresult = (event) => {
        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          const result = event.results[i];
          const text = (result?.[0]?.transcript || "").trim();
          if (!text) continue;
          if (!result.isFinal) {
            setPartial({ text, offsetMs: Date.now() });
            continue;
          }
          setPartial(null);
          setFinals((previous) => [
            ...previous,
            {
              text,
              offsetMs: Date.now(),
              durationMs: 0,
            },
          ]);
        }
      };

      recognizer.onerror = (event) => {
        setError(event?.error || "Speech recognition error");
        setListening(false);
      };
      recognizer.onend = () => setListening(false);

      recognizerRef.current = recognizer;
      setReady(true);
      return () => {
        recognizer.stop();
        recognizerRef.current = null;
      };
    } catch (err) {
      setError(String(err?.message || err));
    }
  }, [language, interimResults]);

  const startListening = useCallback(() => {
    if (!recognizerRef.current || isListening) return;
    setError(null);
    recognizerRef.current.start();
    setListening(true);
  }, [isListening]);

  const stopListening = useCallback(() => {
    if (!recognizerRef.current || !isListening) return;
    recognizerRef.current.stop();
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
    reset,
  };
}
