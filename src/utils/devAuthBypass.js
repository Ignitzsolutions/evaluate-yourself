const TRUTHY = new Set(["1", "true", "yes", "on"]);

const isLoopbackHost = (host) => host === "localhost" || host === "127.0.0.1" || host === "::1";

export function isDevAuthBypassEnabled() {
  const explicit = (process.env.REACT_APP_DEV_AUTH_BYPASS || "").trim().toLowerCase();
  if (explicit) return TRUTHY.has(explicit);

  if (process.env.NODE_ENV === "production") return false;
  if (typeof window === "undefined") return true;

  return isLoopbackHost(window.location.hostname);
}
