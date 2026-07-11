/**
 * SSE wrapper for /api/admin/live/stream.
 * Mints a short-lived admin token (since EventSource cannot send headers),
 * subscribes, and dispatches typed events to listeners. Reconnects on error.
 */

import { apiUrl } from "./apiBaseUrl";

export function connectAdminLiveStream({ getAuthToken, onEvent, onStatus } = {}) {
  let es = null;
  let stopped = false;
  let retryMs = 1500;
  let liveToken = null;
  let liveTokenExpiresAt = 0;

  const status = (s, extra) => {
    if (typeof onStatus === "function") {
      try { onStatus(s, extra); } catch { /* noop */ }
    }
  };

  async function fetchLiveToken() {
    const bearer = await getAuthToken();
    if (!bearer) throw new Error("Not authenticated");
    const resp = await fetch(apiUrl("/api/admin/live/token"), {
      headers: { Authorization: `Bearer ${bearer}` },
    });
    if (!resp.ok) throw new Error(`live token failed: ${resp.status}`);
    const data = await resp.json();
    liveToken = data.token;
    liveTokenExpiresAt = Date.now() + Math.max(60_000, (data.expires_in || 3600) * 900);
    return liveToken;
  }

  async function open() {
    if (stopped) return;
    try {
      if (!liveToken || Date.now() > liveTokenExpiresAt) {
        await fetchLiveToken();
      }
      const url = apiUrl("/api/admin/live/stream", { token: liveToken });
      es = new EventSource(url);

      const dispatch = (evt, parsed) => {
        if (typeof onEvent === "function") {
          try { onEvent(evt, parsed); } catch { /* noop */ }
        }
      };

      es.addEventListener("hello", (e) => {
        status("connected");
        retryMs = 1500;
        try { dispatch("hello", JSON.parse(e.data || "{}")); } catch { dispatch("hello", {}); }
      });
      es.addEventListener("presence", (e) => {
        try { dispatch("presence", JSON.parse(e.data || "{}")); } catch { /* noop */ }
      });
      es.addEventListener("usage", (e) => {
        try { dispatch("usage", JSON.parse(e.data || "{}")); } catch { /* noop */ }
      });
      es.addEventListener("session", (e) => {
        try { dispatch("session", JSON.parse(e.data || "{}")); } catch { /* noop */ }
      });
      es.addEventListener("ping", () => { /* keepalive */ });

      es.onerror = () => {
        status("disconnected");
        try { es.close(); } catch { /* noop */ }
        es = null;
        if (stopped) return;
        const wait = Math.min(retryMs, 30_000);
        retryMs = Math.min(retryMs * 2, 30_000);
        setTimeout(open, wait);
      };
    } catch (err) {
      status("error", err?.message || String(err));
      if (stopped) return;
      setTimeout(open, Math.min(retryMs, 30_000));
      retryMs = Math.min(retryMs * 2, 30_000);
    }
  }

  open();

  return {
    close() {
      stopped = true;
      if (es) { try { es.close(); } catch { /* noop */ } }
      es = null;
    },
  };
}
