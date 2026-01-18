// Vite configuration (if you switch from Create React App to Vite)
// This proxy avoids CORS issues by forwarding /api requests to the backend
export default {
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
        secure: false,
      },
    },
  },
};
