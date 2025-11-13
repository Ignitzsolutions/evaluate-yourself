import { useState, useEffect, useRef, useCallback } from "react";

interface GazeMetrics {
  eyeContact: number;
  attention: "Good" | "Fair" | "Poor";
  isLookingAtCamera: boolean;
}

export function useGazeTracking(videoElement: HTMLVideoElement | null, isActive: boolean) {
  const [metrics, setMetrics] = useState<GazeMetrics>({
    eyeContact: 0,
    attention: "Good",
    isLookingAtCamera: false,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const modelRef = useRef<any>(null);
  const animationFrameRef = useRef<number | null>(null);
  const eyeContactHistory = useRef<number[]>([]);

  useEffect(() => {
    if (!isActive || !videoElement) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      return;
    }

    const initModel = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const script = document.createElement("script");
        script.src = "https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@latest";
        document.head.appendChild(script);
        
        await new Promise((resolve) => {
          script.onload = resolve;
        });

        const yoloScript = document.createElement("script");
        yoloScript.src = "https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd@latest";
        document.head.appendChild(yoloScript);
        
        await new Promise((resolve) => {
          yoloScript.onload = resolve;
        });

        const tf = (window as any).tf;
        const cocoSsd = (window as any).cocoSsd;
        if (cocoSsd) {
          const model = await cocoSsd.load();
          modelRef.current = model;
        }
        setIsLoading(false);
      } catch (err) {
        setError("Model loading failed. Using fallback detection.");
        setIsLoading(false);
        modelRef.current = "fallback";
      }
    };

    initModel();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isActive, videoElement]);

  const detectGaze = useCallback(async () => {
    if (!videoElement || !isActive || videoElement.readyState < 2) return;

    if (!canvasRef.current) {
      const canvas = document.createElement("canvas");
      canvas.width = videoElement.videoWidth || 640;
      canvas.height = videoElement.videoHeight || 480;
      canvasRef.current = canvas;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);

    try {
      let eyeContact = 0;
      let isLookingAtCamera = false;

      if (modelRef.current && modelRef.current !== "fallback") {
        const predictions = await modelRef.current.detect(canvas);
        const personDetections = predictions.filter((p: any) => p.class === "person");
        
        if (personDetections.length > 0) {
          const person = personDetections[0];
          const bbox = person.bbox;
          const faceCenterX = bbox[0] + bbox[2] / 2;
          const faceCenterY = bbox[1] + bbox[3] / 3;
          const canvasCenterX = canvas.width / 2;
          const canvasCenterY = canvas.height / 2;
          
          const distanceX = Math.abs(faceCenterX - canvasCenterX);
          const distanceY = Math.abs(faceCenterY - canvasCenterY);
          const maxDistance = Math.sqrt(canvas.width ** 2 + canvas.height ** 2);
          const normalizedDistance = Math.sqrt(distanceX ** 2 + distanceY ** 2) / maxDistance;
          
          eyeContact = Math.max(0, Math.min(100, (1 - normalizedDistance * 1.5) * 100));
          isLookingAtCamera = normalizedDistance < 0.15;
        }
      } else {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        let facePixels = 0;
        let centerFacePixels = 0;
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const centerRadius = Math.min(canvas.width, canvas.height) * 0.2;
        
        for (let y = 0; y < canvas.height; y++) {
          for (let x = 0; x < canvas.width; x++) {
            const idx = (y * canvas.width + x) * 4;
            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];
            
            const skinTone = r > 95 && g > 40 && b > 20 && 
                            Math.max(r, g, b) - Math.min(r, g, b) > 15 &&
                            Math.abs(r - g) > 15 && r > g && r > b;
            
            if (skinTone) {
              facePixels++;
              const distFromCenter = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
              if (distFromCenter < centerRadius) {
                centerFacePixels++;
              }
            }
          }
        }
        
        const faceRatio = facePixels / (canvas.width * canvas.height);
        const centerRatio = centerFacePixels / (Math.PI * centerRadius ** 2);
        eyeContact = Math.min(100, Math.max(0, (faceRatio * 150) + (centerRatio * 50)));
        isLookingAtCamera = centerRatio > 0.3;
      }

      eyeContactHistory.current.push(eyeContact);
      if (eyeContactHistory.current.length > 30) {
        eyeContactHistory.current.shift();
      }

      const avgEyeContact = eyeContactHistory.current.reduce((a, b) => a + b, 0) / eyeContactHistory.current.length;
      
      setMetrics({
        eyeContact: Math.round(avgEyeContact),
        attention: avgEyeContact > 70 ? "Good" : avgEyeContact > 40 ? "Fair" : "Poor",
        isLookingAtCamera,
      });
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      }
    }

    if (isActive) {
      animationFrameRef.current = requestAnimationFrame(detectGaze);
    }
  }, [videoElement, isActive]);

  useEffect(() => {
    if (isActive && videoElement && videoElement.readyState >= 2) {
      animationFrameRef.current = requestAnimationFrame(detectGaze);
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isActive, videoElement, detectGaze]);

  return { metrics, isLoading, error };
}

