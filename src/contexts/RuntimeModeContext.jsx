/**
 * RuntimeModeContext — single source of truth for server-driven feature
 * descriptors. Fetched once at app boot from /api/system/runtime-mode and
 * provided to any component that needs to render demo banners, hide voice
 * features, etc.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { getApiBaseUrl } from "../utils/apiBaseUrl";

const DEFAULT_STATE = {
  loading: true,
  demo_mode: false,
  openai_configured: false,
  realtime_enabled: false,
  mfa_enabled: true,
  lockout_enabled: true,
  admin_live_ops_enabled: true,
  communication_practice_enabled: true,
  usage_recording_enabled: true,
  environment: "development",
};

const RuntimeModeContext = createContext({ ...DEFAULT_STATE, refresh: () => {} });

export function RuntimeModeProvider({ children }) {
  const [state, setState] = useState(DEFAULT_STATE);

  const load = useCallback(async () => {
    try {
      const base = getApiBaseUrl();
      const res = await fetch(`${base}/api/system/runtime-mode`, {
        method: "GET",
        credentials: "include",
      });
      if (!res.ok) {
        setState((s) => ({ ...s, loading: false }));
        return;
      }
      const data = await res.json();
      setState({ ...DEFAULT_STATE, ...data, loading: false });
    } catch (_err) {
      // Fail open — assume defaults if the endpoint is unreachable so the
      // app still renders.
      setState((s) => ({ ...s, loading: false }));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const value = useMemo(() => ({ ...state, refresh: load }), [state, load]);

  return <RuntimeModeContext.Provider value={value}>{children}</RuntimeModeContext.Provider>;
}

export function useRuntimeMode() {
  return useContext(RuntimeModeContext);
}

export default RuntimeModeContext;
