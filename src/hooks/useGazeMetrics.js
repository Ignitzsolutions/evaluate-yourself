import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const getEnv = (k) =>
  (typeof import.meta !== "undefined" ? import.meta.env?.[k] : undefined) ||
  process.env[k];

export default function useGazeMetrics() {
  const url =
    getEnv("VITE_GAZE_WS_URL") || getEnv("REACT_APP_GAZE_WS_URL") || null;
  const wsRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [metrics, setMetrics] = useState({
    t: Date.now(),
    eyeContact: true,
    eyeContactPct: 0,
    blink: false,
    conf: 0.7,
  });
  const [samples, setSamples] = useState(0);
  const [inContact, setInContact] = useState(0);

  const connect = useCallback(() => {
    if (!url || wsRef.current) return;
    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;
      ws.onopen = () => setConnected(true);
      ws.onclose = () => {
        setConnected(false);
        wsRef.current = null;
      };
      ws.onerror = () => {
        setConnected(false);
        wsRef.current = null;
      };
      ws.onmessage = (ev) => {
        try {
          const m = JSON.parse(ev.data);
          setMetrics((prev) => ({ ...prev, ...m }));
          setSamples((s) => s + 1);
          setInContact((c) => c + (m.eyeContact ? 1 : 0));
        } catch {}
      };
    } catch {
      setConnected(false);
      wsRef.current = null;
    }
  }, [url]);

  const disconnect = useCallback(() => {
    wsRef.current?.close();
    wsRef.current = null;
  }, []);

  // Simulation mode if not connected to any WS:
  useEffect(() => {
    if (connected || url) return;
    let id = setInterval(() => {
      // mild variations to feel live
      setMetrics((m) => {
        const flip = Math.random() < 0.08 ? !m.eyeContact : m.eyeContact;
        return {
          ...m,
          t: Date.now(),
          eyeContact: flip,
          blink: Math.random() < 0.05,
          conf: 0.7 + (Math.random() - 0.5) * 0.1,
        };
      });
      setSamples((s) => s + 1);
      setInContact((c) =>
        metrics.eyeContact ? c + 1 : c
      );
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected, url]);

  const eyeContactPct = useMemo(
    () => (samples ? inContact / samples : 0),
    [samples, inContact]
  );

  return {
    connected,
    connect,
    disconnect,
    metrics: { ...metrics, eyeContactPct },
  };
}