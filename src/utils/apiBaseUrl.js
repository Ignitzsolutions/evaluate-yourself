const readViteApiUrl = () => {
  return process.env.VITE_API_URL || "";
};

const isLoopbackHost = (host) => host === "localhost" || host === "127.0.0.1" || host === "::1";

export function getApiBaseUrl() {
  const configured = (readViteApiUrl() || process.env.REACT_APP_API_URL || "").trim();
  if (!configured) return "";

  try {
    const parsed = new URL(configured);
    if (isLoopbackHost(parsed.hostname)) {
      const currentHost = typeof window !== "undefined" ? window.location.hostname : "";
      if (currentHost && !isLoopbackHost(currentHost)) {
        // In hosted environments never call loopback; use same-origin API.
        return "";
      }
    }
    return configured.replace(/\/+$/, "");
  } catch (error) {
    return configured.replace(/\/+$/, "");
  }
}
