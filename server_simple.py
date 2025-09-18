# server_simple.py - Simplified version using OpenCV face detection
import base64, io, time, asyncio, json
import numpy as np
import cv2
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], allow_methods=["*"], allow_headers=["*"], allow_credentials=True
)

# Load OpenCV's pre-trained face detector
face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')

def simple_eye_contact_detection(frame):
    """
    Simplified eye contact detection using basic image processing
    Returns mock data for testing purposes
    """
    # Convert to grayscale for face detection
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

    # Detect faces
    faces = face_cascade.detectMultiScale(gray, 1.3, 5)

    if len(faces) == 0:
        return {
            "eyeContact": False,
            "blink": False,
            "conf": 0.0,
            "earLeft": 0.0,
            "earRight": 0.0
        }

    # Take the largest face
    (x, y, w, h) = max(faces, key=lambda f: f[2] * f[3])

    # Simple eye region extraction (approximate)
    eye_height = int(h * 0.25)
    left_eye_region = gray[y:y+eye_height, x:int(x+w*0.4)]
    right_eye_region = gray[y:y+eye_height, int(x+w*0.6):x+w]

    # Simple brightness-based eye contact detection
    left_brightness = np.mean(left_eye_region) if left_eye_region.size > 0 else 0
    right_brightness = np.mean(right_eye_region) if right_eye_region.size > 0 else 0

    # Mock eye contact based on face size and position
    face_center_x = x + w/2
    frame_center_x = frame.shape[1] / 2
    horizontal_offset = abs(face_center_x - frame_center_x) / (frame.shape[1] / 2)

    # Simple heuristics
    eye_contact = horizontal_offset < 0.3 and w > 100  # Face centered and large enough
    confidence = min(1.0, w / 200.0)  # Confidence based on face size

    return {
        "eyeContact": bool(eye_contact),
        "blink": False,  # Not implemented in simple version
        "conf": float(confidence),
        "earLeft": float(left_brightness / 255.0),
        "earRight": float(right_brightness / 255.0)
    }

class EMA:
    def __init__(self, alpha=0.3): self.alpha, self.value = alpha, None
    def update(self, x):
        self.value = x if self.value is None else self.alpha * x + (1 - self.alpha) * self.value
        return self.value

@app.websocket("/ws")
async def ws_endpoint(ws: WebSocket):
    await ws.accept()
    contact_ema = EMA(0.2)
    eye_contact_pct = 0.0
    total_samples = 0
    in_contact = 0

    try:
        while True:
            msg = await ws.receive_text()
            data = json.loads(msg)
            if data.get("type") != "frame":
                continue

            # Decode dataURL
            b64 = data["data"].split(",")[1]
            buf = np.frombuffer(base64.b64decode(b64), dtype=np.uint8)
            frame = cv2.imdecode(buf, cv2.IMREAD_COLOR)

            # Get eye tracking metrics
            metrics = simple_eye_contact_detection(frame)

            # Update rolling statistics
            contact_now = metrics["eyeContact"]
            contact_s = contact_ema.update(1.0 if contact_now else 0.0)
            total_samples += 1
            if contact_now: in_contact += 1
            eye_contact_pct = float(in_contact / max(1, total_samples))

            await ws.send_text(json.dumps({
                "t": int(time.time()*1000),
                "earLeft": round(metrics["earLeft"], 4),
                "earRight": round(metrics["earRight"], 4),
                "blink": metrics["blink"],
                "eyeContact": bool(contact_s > 0.5),
                "eyeContactPct": round(eye_contact_pct, 3),
                "gazeVector": [0.0, 0.0],  # Not implemented in simple version
                "conf": round(metrics["conf"], 3)
            }))
    except WebSocketDisconnect:
        return

if __name__ == "__main__":
    import uvicorn
    print("🚀 Starting Simplified Eye Tracking Server...")
    print("📊 WebSocket endpoint: ws://localhost:8000/ws")
    print("📚 API docs: http://localhost:8000/docs")
    uvicorn.run(app, host="0.0.0.0", port=8000)