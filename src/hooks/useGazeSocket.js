// src/hooks/useGazeSocket.js
import { useEffect, useRef, useState, useCallback } from "react";

/**
 * Custom hook for WebSocket connection to backend gaze analysis service.
 * Sends webcam frames to backend for eye tracking analysis.
 * 
 * The backend service analyzes frames using:
 * - Face landmarks
 * - Eye gaze direction and head pose analysis
 * - Attention metrics calculation
 *
 * @param {string} serverUrl WebSocket server URL for gaze analysis
 * @returns {Object} Connection state, control functions, and analysis metrics
 */
export function useGazeSocket(serverUrl) {
  const wsRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [metrics, setMetrics] = useState(null);

  // Connect to WebSocket server for gaze analysis integration
  const connect = useCallback(() => {
    if (wsRef.current) return;
    
    const ws = new WebSocket(serverUrl);
    wsRef.current = ws;
    
    // Handle WebSocket connection events
    ws.onopen = () => {
      setConnected(true);
      
      // Initial handshake to verify service connectivity
      ws.send(JSON.stringify({ 
        type: "init", 
        clientInfo: {
          userAgent: navigator.userAgent,
          timestamp: Date.now()
        }
      }));
    };
    
    ws.onclose = () => { 
      setConnected(false); 
      wsRef.current = null; 
    };
    
    ws.onerror = (error) => { 
      setConnected(false); 
    };
    
    // Process gaze analysis results
    ws.onmessage = (ev) => {
      try { 
        const data = JSON.parse(ev.data);
        
        // Structure expected from gaze analysis backend
        // {
        //   eyeContact: boolean,      // Whether user is making eye contact
        //   eyeContactPct: number,    // Percentage of eye contact over time
        //   blink: boolean,           // Whether user is blinking
        //   earLeft: number,          // Eye aspect ratio (left eye)
        //   earRight: number,         // Eye aspect ratio (right eye)
        //   gazeDirection: string     // Direction of gaze
        // }
        
        setMetrics(data); 
      } catch (error) {
        console.error("Error parsing gaze response:", error);
      }
    };
  }, [serverUrl]);

  // Disconnect from WebSocket server
  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  // Send video frame to gaze analysis service
  const sendFrame = useCallback(async (dataUrl) => {
    if (!wsRef.current || wsRef.current.readyState !== 1) return;
    
    // Frame format: JPEG dataURL (base64)
    wsRef.current.send(JSON.stringify({ 
      type: "frame", 
      data: dataUrl,
      timestamp: Date.now()
    }));
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, []);

  return { 
    connected,      // Whether connected to gaze backend
    connect,        // Function to connect to gaze backend
    disconnect,     // Function to disconnect from gaze backend
    sendFrame,      // Function to send frame for gaze analysis
    metrics         // Results from gaze analysis
  };
}