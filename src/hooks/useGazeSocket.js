// src/hooks/useGazeSocket.js
import { useEffect, useRef, useState, useCallback } from "react";

/**
 * Custom hook for WebSocket connection to backend service that integrates with Azure Face API
 * Sends webcam frames to backend which processes them using Azure Face API for eye tracking
 * 
 * The backend service analyzes frames using:
 * - Azure Face API for facial landmarks
 * - Eye gaze direction and head pose analysis
 * - Attention metrics calculation
 * 
 * API Documentation: https://learn.microsoft.com/en-us/azure/cognitive-services/computer-vision/overview-identity
 * 
 * @param {string} serverUrl WebSocket server URL that proxies to Azure Face API
 * @returns {Object} Connection state, control functions, and analysis metrics
 */
export function useGazeSocket(serverUrl) {
  const wsRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [metrics, setMetrics] = useState(null);

  // Connect to WebSocket server for Azure Face API integration
  const connect = useCallback(() => {
    if (wsRef.current) return;
    
    console.log("Connecting to Azure Face API proxy service...");
    const ws = new WebSocket(serverUrl);
    wsRef.current = ws;
    
    // Handle WebSocket connection events
    ws.onopen = () => {
      console.log("Connected to Azure Face API proxy service");
      setConnected(true);
      
      // Initial handshake to verify Azure Face API connectivity
      ws.send(JSON.stringify({ 
        type: "init", 
        clientInfo: {
          userAgent: navigator.userAgent,
          timestamp: Date.now()
        }
      }));
    };
    
    ws.onclose = () => { 
      console.log("Disconnected from Azure Face API proxy service");
      setConnected(false); 
      wsRef.current = null; 
    };
    
    ws.onerror = (error) => { 
      console.error("Azure Face API proxy connection error:", error);
      setConnected(false); 
    };
    
    // Process Azure Face API analysis results
    ws.onmessage = (ev) => {
      try { 
        const data = JSON.parse(ev.data);
        
        // Structure expected from Azure Face API proxy
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
        console.error("Error parsing Azure Face API response:", error);
      }
    };
  }, [serverUrl]);

  // Disconnect from WebSocket server
  const disconnect = useCallback(() => {
    if (wsRef.current) {
      console.log("Disconnecting from Azure Face API proxy service");
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  // Send video frame to Azure Face API proxy service
  const sendFrame = useCallback(async (dataUrl) => {
    if (!wsRef.current || wsRef.current.readyState !== 1) return;
    
    // Optimize payload for Azure Face API processing
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
    connected,      // Whether connected to Azure Face API proxy
    connect,        // Function to connect to Azure Face API proxy
    disconnect,     // Function to disconnect from Azure Face API proxy
    sendFrame,      // Function to send frame for Azure Face API analysis
    metrics         // Results from Azure Face API analysis
  };
}