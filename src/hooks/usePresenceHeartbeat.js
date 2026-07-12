/**
 * Pings /api/me/heartbeat every 30s while the user is signed in,
 * so the admin live dashboard can see who's online.
 *
 * Mount once at the app shell level inside the auth provider tree.
 */
import { useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { authFetch } from "../utils/apiClient";
import { apiUrl } from "../utils/apiBaseUrl";

const INTERVAL_MS = 30_000;

export function usePresenceHeartbeat({ enabled = true } = {}) {
  const { isSignedIn, getToken } = useAuth();
  const lastRouteRef = useRef("");

  useEffect(() => {
    if (!enabled || !isSignedIn) return undefined;

    const send = async () => {
      try {
        const token = await getToken().catch(() => null);
        if (!token) return;
        const route = typeof window !== "undefined" ? window.location.pathname : "";
        lastRouteRef.current = route;
        await authFetch(apiUrl("/api/me/heartbeat"), token, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ route }),
        });
      } catch {
        /* swallow */
      }
    };

    send();
    const id = window.setInterval(send, INTERVAL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") send();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [enabled, isSignedIn, getToken]);
}
