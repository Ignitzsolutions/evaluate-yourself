// src/config/services.js

const getEnvVar = (key, fallback = "") => process.env[`REACT_APP_${key}`] || fallback;

export const speechConfig = {
  language: "en-US",
  provider: "browser-web-speech",
};

export const faceTrackingConfig = {
  provider: "mediapipe-face-landmarker",
  wasmRoot:
    getEnvVar("MEDIAPIPE_WASM_ROOT") ||
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm",
};

export const textAnalysisConfig = {
  provider: "openai",
  endpoint: "/api/analysis",
};

export const securityConfig = {
  allowedOrigins:
    process.env.NODE_ENV === "production"
      ? ["https://evaluate-yourself.com"]
      : ["http://localhost:3000"],
  proxyEndpoints: {
    speech: "/api/realtime",
    face: "/api/gaze",
    textAnalysis: "/api/analysis",
  },
};
