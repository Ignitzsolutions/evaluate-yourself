import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { getApiBaseUrl } from "../utils/apiBaseUrl";
import { isDevAuthBypassEnabled } from "../utils/devAuthBypass";

const AuthContext = createContext(null);
const API_BASE = getApiBaseUrl();

function decodePayload(token) {
  try {
    return JSON.parse(atob(token.split(".")[1]));
  } catch {
    return null;
  }
}

function isTokenExpiringSoon(token, thresholdMs = 60000) {
  const payload = decodePayload(token);
  if (!payload?.exp) return true;
  return payload.exp * 1000 - Date.now() < thresholdMs;
}

function readCookie(name) {
  if (typeof document === "undefined") return null;
  const prefix = `${name}=`;
  return document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix))
    ?.slice(prefix.length) || null;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [accessToken, setAccessToken] = useState(null);
  const [csrfToken, setCsrfToken] = useState(null);
  const refreshTimerRef = useRef(null);
  const devBypass = isDevAuthBypassEnabled();

  const clearAuth = useCallback(() => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    setAccessToken(null);
    setCsrfToken(null);
    setUser(null);
    setIsSignedIn(false);
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
  }, []);

  const scheduleRefresh = useCallback((tokenOverride = null) => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    const token = tokenOverride || accessToken;
    if (!token) return;
    const payload = decodePayload(token);
    if (!payload?.exp) return;
    const delay = payload.exp * 1000 - Date.now() - 60000; // 60s before expiry
    if (delay > 0) {
      refreshTimerRef.current = setTimeout(() => tryRefresh(), delay);
    }
  }, [accessToken]); // eslint-disable-line react-hooks/exhaustive-deps

  const tryRefresh = useCallback(async () => {
    const csrf = csrfToken || readCookie("ey_csrf_token");
    try {
      const resp = await fetch(`${API_BASE}/api/auth/refresh`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(csrf ? { "X-CSRF-Token": csrf } : {}),
        },
        body: JSON.stringify({ csrf_token: csrf || undefined }),
      });
      if (resp.ok) {
        const data = await resp.json();
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        setAccessToken(data.access_token);
        setCsrfToken(data.csrf_token || csrf || null);
        setUser(data.user);
        setIsSignedIn(true);
        scheduleRefresh(data.access_token);
        return data.access_token;
      }
    } catch { /* ignore */ }
    return false;
  }, [csrfToken, scheduleRefresh]);

  const fetchMe = useCallback(async (token) => {
    try {
      const resp = await fetch(`${API_BASE}/api/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resp.ok) {
        const data = await resp.json();
        setUser(data);
        setIsSignedIn(true);
        scheduleRefresh(token);
      } else {
        const refreshed = await tryRefresh();
        if (!refreshed) clearAuth();
      }
    } catch {
      clearAuth();
    } finally {
      setIsLoaded(true);
    }
  }, [clearAuth, scheduleRefresh, tryRefresh]);

  useEffect(() => {
    if (devBypass) {
      setUser({ id: "dev-local-admin", full_name: "Local Dev Admin", email: "dev@localhost", is_admin: true });
      setIsSignedIn(true);
      setIsLoaded(true);
      return;
    }
    const token = accessToken || localStorage.getItem("access_token");
    if (token && !isTokenExpiringSoon(token, 0)) {
      setAccessToken(token);
      localStorage.removeItem("access_token");
      fetchMe(token);
    } else if (token) {
      // Token exists but expired — try refresh
      tryRefresh().then((ok) => {
        if (!ok) clearAuth();
        setIsLoaded(true);
      });
    } else {
      const csrf = readCookie("ey_csrf_token");
      if (csrf) {
        setCsrfToken(csrf);
        tryRefresh().then((ok) => {
          if (!ok) clearAuth();
          setIsLoaded(true);
        });
      } else {
        setIsLoaded(true);
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const getToken = useCallback(async () => {
    if (devBypass) return null;
    const token = accessToken;
    if (token && isTokenExpiringSoon(token)) {
      const refreshed = await tryRefresh();
      if (refreshed) return refreshed;
    }
    if (!token && readCookie("ey_csrf_token")) {
      const refreshed = await tryRefresh();
      if (refreshed) return refreshed;
    }
    return token;
  }, [accessToken, devBypass, tryRefresh]);

  const login = useCallback(async (email, password) => {
    const resp = await fetch(`${API_BASE}/api/auth/login`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await resp.json();
    if (!resp.ok) throw data?.error || data;
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    setAccessToken(data.access_token);
    setCsrfToken(data.csrf_token || null);
    setUser(data.user);
    setIsSignedIn(true);
    scheduleRefresh(data.access_token);
    return data;
  }, [scheduleRefresh]);

  const register = useCallback(async (email, password, fullName) => {
    const resp = await fetch(`${API_BASE}/api/auth/register`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, full_name: fullName }),
    });
    const data = await resp.json();
    if (!resp.ok) throw data?.error || data;
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    setAccessToken(data.access_token);
    setCsrfToken(data.csrf_token || null);
    setUser(data.user);
    setIsSignedIn(true);
    scheduleRefresh(data.access_token);
    return data;
  }, [scheduleRefresh]);

  const signOut = useCallback(async () => {
    const token = accessToken;
    try {
      await fetch(`${API_BASE}/api/auth/logout`, {
        method: "POST",
        credentials: "include",
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ csrf_token: csrfToken || undefined }),
      });
    } catch { /* best effort */ }
    clearAuth();
  }, [accessToken, clearAuth, csrfToken]);

  const value = { user, isLoaded, isSignedIn, getToken, login, register, signOut };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return { isLoaded: ctx.isLoaded, isSignedIn: ctx.isSignedIn, getToken: ctx.getToken, signOut: ctx.signOut };
}

export function useUser() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useUser must be used within AuthProvider");
  return { user: ctx.user, isSignedIn: ctx.isSignedIn };
}

export function useClerk() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useClerk must be used within AuthProvider");
  return { signOut: ctx.signOut };
}

export function useAuthActions() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuthActions must be used within AuthProvider");
  return { login: ctx.login, register: ctx.register, signOut: ctx.signOut };
}
