import { useCallback, useEffect, useRef, useState } from "react";
import {
  CONVERSATIONAL_FILLER_PACK_VERSION,
  listConversationalFillerClips,
  pickConversationalFillerClip,
  normalizeConversationalFillerHint,
} from "../utils/conversationalFillers";
import AudioBufferService from "../services/AudioBufferService";

export default function useConversationalFillers() {
  const timerRef = useRef(null);
  const utteranceRef = useRef(null);
  const audioServiceRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentFiller, setCurrentFiller] = useState(null);

  useEffect(() => {
    if (!audioServiceRef.current) {
      audioServiceRef.current = new AudioBufferService();
    }
    audioServiceRef.current.preload(listConversationalFillerClips());
  }, []);

  const stop = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (typeof window !== "undefined" && window.speechSynthesis) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // no-op
      }
    }
    if (utteranceRef.current) {
      utteranceRef.current.onend = null;
      utteranceRef.current.onerror = null;
      utteranceRef.current = null;
    }
    audioServiceRef.current?.stop();
    setIsPlaying(false);
    setCurrentFiller(null);
  }, []);

  const play = useCallback((hint = "thinking", options = {}) => {
    stop();
    const delayMs = Number.isFinite(options.delayMs) ? Math.max(0, options.delayMs) : 0;
    const normalizedHint = normalizeConversationalFillerHint(hint);
    const clip = pickConversationalFillerClip(normalizedHint, options.seed || "");

    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      setCurrentFiller({
        ...clip,
        hint: normalizedHint,
        version: CONVERSATIONAL_FILLER_PACK_VERSION,
      });
      setIsPlaying(true);

      const handlePlaybackEnded = () => {
        setIsPlaying(false);
        setCurrentFiller(null);
      };

      const audioService = audioServiceRef.current;
      if (audioService) {
        audioService
          .play(clip, {
            volume: Number.isFinite(options.volume) ? options.volume : 1,
            onEnded: handlePlaybackEnded,
            onError: () => {
              setIsPlaying(false);
              setCurrentFiller(null);
            },
          })
          .then((started) => {
            if (!started) {
              const fallbackDurationMs = Math.max(700, clip.text.length * 45);
              timerRef.current = setTimeout(() => {
                timerRef.current = null;
                setIsPlaying(false);
                setCurrentFiller(null);
              }, fallbackDurationMs);
            }
          });
        return;
      }

      if (typeof window === "undefined" || !window.speechSynthesis || typeof SpeechSynthesisUtterance === "undefined") {
        const durationMs = Math.max(700, clip.text.length * 45);
        timerRef.current = setTimeout(() => {
          timerRef.current = null;
          setIsPlaying(false);
          setCurrentFiller(null);
        }, durationMs);
        return;
      }

      const utterance = new SpeechSynthesisUtterance(clip.text);
      utterance.rate = Number.isFinite(options.rate) ? options.rate : 0.92;
      utterance.pitch = Number.isFinite(options.pitch) ? options.pitch : 0.95;
      utterance.volume = Number.isFinite(options.volume) ? options.volume : 1;
      utterance.onend = () => {
        utteranceRef.current = null;
        handlePlaybackEnded();
      };
      utterance.onerror = () => {
        setIsPlaying(false);
        utteranceRef.current = null;
        setCurrentFiller(null);
      };
      utteranceRef.current = utterance;
      try {
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utterance);
      } catch {
        setIsPlaying(false);
        utteranceRef.current = null;
        setCurrentFiller(null);
      }
    }, delayMs);
  }, [stop]);

  useEffect(() => () => stop(), [stop]);

  return {
    isPlaying,
    currentFiller,
    playFiller: play,
    stopFiller: stop,
  };
}
