// src/components/WebcamToGaze.js
import React, { useEffect, useRef, useState } from "react";
import { useGazeSocket } from "../hooks/useGazeSocket";
import { Box, Button, Typography, Paper } from "@mui/material";
import { Videocam, VideocamOff, Wifi, WifiOff } from "@mui/icons-material";

export default function WebcamToGaze() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [running, setRunning] = useState(false);
  const { connected, connect, disconnect, sendFrame, metrics } = useGazeSocket("ws://localhost:8000/ws");

  useEffect(() => {
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 }, audio: false });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
      } catch (error) {
        console.error("Error accessing webcam:", error);
      }
    })();
  }, []);

  useEffect(() => {
    if (!running) return;
    let raf = 0; let last = 0;
    const fps = 8; // tune 5–10
    const interval = 1000 / fps;

    const loop = (t) => {
      raf = requestAnimationFrame(loop);
      if (t - last < interval) return;
      last = t;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      const W = 320, H = 240;
      canvas.width = W; canvas.height = H;
      ctx.drawImage(video, 0, 0, W, H);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.6); // compressed
      sendFrame(dataUrl);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [running, sendFrame]);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
        <Button
          variant="contained"
          color="primary"
          startIcon={connected ? <Wifi /> : <WifiOff />}
          onClick={connected ? disconnect : connect}
          sx={{ minWidth: 120 }}
        >
          {connected ? "Disconnect" : "Connect"}
        </Button>
        <Button
          variant="outlined"
          color="secondary"
          startIcon={running ? <VideocamOff /> : <Videocam />}
          onClick={() => setRunning(s => !s)}
          disabled={!connected}
          sx={{ minWidth: 120 }}
        >
          {running ? "Stop" : "Start"}
        </Button>
      </Box>

      <Box
        component="video"
        ref={videoRef}
        muted
        playsInline
        sx={{
          width: 320,
          height: 240,
          borderRadius: 2,
          background: "#000",
          objectFit: "cover"
        }}
      />

      <Box component="canvas" ref={canvasRef} sx={{ display: "none" }} />

      <Paper elevation={1} sx={{ p: 2, borderRadius: 2 }}>
        <Typography variant="subtitle2" gutterBottom>
          Eye Tracking Metrics
        </Typography>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
          <Box sx={{ display: "flex", justifyContent: "space-between" }}>
            <Typography variant="body2" color="text.secondary">Status:</Typography>
            <Typography variant="body2" sx={{ color: connected ? "success.main" : "error.main", fontWeight: 500 }}>
              {connected ? "Connected" : "Disconnected"}
            </Typography>
          </Box>
          <Box sx={{ display: "flex", justifyContent: "space-between" }}>
            <Typography variant="body2" color="text.secondary">Eye contact:</Typography>
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              {metrics?.eyeContact ? "✅" : "⚠️"}
            </Typography>
          </Box>
          <Box sx={{ display: "flex", justifyContent: "space-between" }}>
            <Typography variant="body2" color="text.secondary">EAR (L/R):</Typography>
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              {metrics?.earLeft?.toFixed?.(3)} / {metrics?.earRight?.toFixed?.(3)}
            </Typography>
          </Box>
          <Box sx={{ display: "flex", justifyContent: "space-between" }}>
            <Typography variant="body2" color="text.secondary">Blink:</Typography>
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              {metrics?.blink ? "Yes" : "No"}
            </Typography>
          </Box>
          <Box sx={{ display: "flex", justifyContent: "space-between" }}>
            <Typography variant="body2" color="text.secondary">Confidence:</Typography>
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              {(metrics?.conf ?? 0).toFixed(2)}
            </Typography>
          </Box>
        </Box>
      </Paper>
    </Box>
  );
}