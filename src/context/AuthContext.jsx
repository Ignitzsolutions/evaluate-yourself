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

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const refreshTimerRef = useRef(null);
  const devBypass = isDevAuthBypassEnabled();

  const clearAuth = useCallback(() => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    setUser(null);
    setIsSignedIn(false);
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
  }, []);

  const scheduleRefresh = useCallback(() => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    const token = localStorage.getItem("access_token");
    if (!token) return;
    const payload = decodePayload(token);
    if (!payload?.exp) return;
    const delay = payload.exp * 1000 - Date.now() - 60000; // 60s before expiry
    if (delay > 0) {
      refreshTimerRef.current = setTimeout(() => tryRefresh(), delay);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const tryRefresh = useCallback(async () => {
    const refreshToken = localStorage.getItem("refresh_token");
    if (!refreshToken) return false;
    try {
      const resp = await fetch(`${API_BASE}/api/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
      if (resp.ok) {
        const data = await resp.json();
        localStorage.setItem("access_token", data.access_token);
        localStorage.setItem("refresh_token", data.refresh_token);
        setUser(data.user);
        setIsSignedIn(true);
        scheduleRefresh();
        return true;
      }
    } catch { /* ignore */ }
    return false;
  }, [scheduleRefresh]);

  const fetchMe = useCallback(async (token) => {
    try {
      const resp = await fetch(`${API_BASE}/api/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resp.ok) {
        const data = await resp.json();
        setUser(data);
        setIsSignedIn(true);
        scheduleRefresh();
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
    const token = localStorage.getItem("access_token");
    if (token && !isTokenExpiringSoon(token, 0)) {
      fetchMe(token);
    } else if (token) {
      // Token exists but expired — try refresh
      tryRefresh().then((ok) => {
        if (!ok) clearAuth();
        setIsLoaded(true);
      });
    } else {
      setIsLoaded(true);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const getToken = useCallback(async () => {
    if (devBypass) return null;
    const token = localStorage.getItem("access_token");
    if (token && isTokenExpiringSoon(token)) {
      const refreshed = await tryRefresh();
      if (refreshed) return localStorage.getItem("access_token");
    }
    return token;
  }, [devBypass, tryRefresh]);

  const login = useCallback(async (email, password) => {
    const resp = await fetch(`${API_BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await resp.json();
    if (!resp.ok) throw data?.error || data;
    localStorage.setItem("access_token", data.access_token);
    localStorage.setItem("refresh_token", data.refresh_token);
    setUser(data.user);
    setIsSignedIn(true);
    scheduleRefresh();
    return data;
  }, [scheduleRefresh]);

  const register = useCallback(async (email, password, fullName) => {
    const resp = await fetch(`${API_BASE}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, full_name: fullName }),
    });
    const data = await resp.json();
    if (!resp.ok) throw data?.error || data;
    localStorage.setItem("access_token", data.access_token);
    localStorage.setItem("refresh_token", data.refresh_token);
    setUser(data.user);
    setIsSignedIn(true);
    scheduleRefresh();
    return data;
  }, [scheduleRefresh]);

  const signOut = useCallback(async () => {
    const token = localStorage.getItem("access_token");
    const refresh = localStorage.getItem("refresh_token");
    try {
      await fetch(`${API_BASE}/api/auth/logout`, {
        method: "POST",
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ refresh_token: refresh }),
      });
    } catch { /* best effort */ }
    clearAuth();
  }, [clearAuth]);

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
