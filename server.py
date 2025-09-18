# server.py
import base64, io, time, asyncio, json
import numpy as np
import cv2
import dlib
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from scipy.spatial import distance as dist

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], allow_methods=["*"], allow_headers=["*"], allow_credentials=True
)

detector = dlib.get_frontal_face_detector()
predictor = dlib.shape_predictor("models/shape_predictor_68_face_landmarks.dat")

LEFT_EYE_IDX  = list(range(36, 42))
RIGHT_EYE_IDX = list(range(42, 48))

def eye_aspect_ratio(eye_pts):
    # eye_pts: 6x2 np.array
    A = dist.euclidean(eye_pts[1], eye_pts[5])
    B = dist.euclidean(eye_pts[2], eye_pts[4])
    C = dist.euclidean(eye_pts[0], eye_pts[3])
    ear = (A + B) / (2.0 * C + 1e-6)
    return float(ear)

def gaze_vector(gray, eye_pts):
    # very simple gaze proxy: pupil center relative to eye bbox center
    (x, y, w, h) = cv2.boundingRect(eye_pts.astype(np.int32))
    roi = gray[y:y+h, x:x+w]
    if roi.size == 0: return (0.0, 0.0), 0.0
    roi = cv2.GaussianBlur(roi, (5,5), 0)
    _, th = cv2.threshold(roi, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    cnts, _ = cv2.findContours(th, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not cnts: return (0.0, 0.0), 0.0
    cnt = max(cnts, key=cv2.contourArea)
    M = cv2.moments(cnt)
    if M["m00"] == 0: return (0.0, 0.0), 0.0
    cx, cy = int(M["m10"]/M["m00"]), int(M["m01"]/M["m00"])
    # normalize to -1..1 relative to eye center
    nx = ((cx - w/2) / (w/2))
    ny = ((cy - h/2) / (h/2))
    conf = min(1.0, cv2.contourArea(cnt) / float(w*h + 1e-6))  # crude confidence proxy
    return (float(nx), float(ny)), float(conf)

def landmarks_to_np(shape):
    coords = np.zeros((68, 2), dtype="int")
    for i in range(68):
        coords[i] = (shape.part(i).x, shape.part(i).y)
    return coords

class EMA:
    def __init__(self, alpha=0.3): self.alpha, self.value = alpha, None
    def update(self, x):
        self.value = x if self.value is None else self.alpha * x + (1 - self.alpha) * self.value
        return self.value

# thresholds (tune for your environment)
EAR_BLINK_THRESHOLD = 0.21
GAZE_MAG_THRESHOLD  = 0.55  # |(nx,ny)| mag beyond this means looking away
MIN_CONFIDENCE      = 0.15

@app.websocket("/ws")
async def ws_endpoint(ws: WebSocket):
    await ws.accept()
    earL_ema, earR_ema = EMA(0.3), EMA(0.3)
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

        # decode dataURL
        b64 = data["data"].split(",")[1]
        buf = np.frombuffer(base64.b64decode(b64), dtype=np.uint8)
        frame = cv2.imdecode(buf, cv2.IMREAD_COLOR)
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

        rects = detector(gray, 0)
        if len(rects) == 0:
            await ws.send_text(json.dumps({
              "t": int(time.time()*1000),
              "earLeft": 0, "earRight": 0, "blink": False,
              "eyeContact": False, "eyeContactPct": eye_contact_pct,
              "gazeVector": [0,0], "conf": 0
            }))
            continue

        # take the largest face
        rect = max(rects, key=lambda r: r.width() * r.height())
        shape = predictor(gray, rect)
        pts = landmarks_to_np(shape)

        leftEye  = pts[LEFT_EYE_IDX]
        rightEye = pts[RIGHT_EYE_IDX]

        earL = eye_aspect_ratio(leftEye)
        earR = eye_aspect_ratio(rightEye)
        earL_s = earL_ema.update(earL)
        earR_s = earR_ema.update(earR)

        # blink if either smoothed EAR < threshold
        blink = (earL_s < EAR_BLINK_THRESHOLD) or (earR_s < EAR_BLINK_THRESHOLD)

        # gaze vector (mean of both eyes)
        gL, cL = gaze_vector(gray, leftEye)
        gR, cR = gaze_vector(gray, rightEye)
        conf = float(min(1.0, (cL + cR) / 2.0))
        gx = (gL[0] + gR[0]) / 2.0
        gy = (gL[1] + gR[1]) / 2.0
        mag = np.hypot(gx, gy)

        # contact if conf ok and gaze near center
        contact_now = (conf >= MIN_CONFIDENCE) and (mag <= GAZE_MAG_THRESHOLD)
        contact_s = contact_ema.update(1.0 if contact_now else 0.0)
        total_samples += 1
        if contact_now: in_contact += 1
        eye_contact_pct = float(in_contact / max(1, total_samples))

        await ws.send_text(json.dumps({
          "t": int(time.time()*1000),
          "earLeft": round(earL_s, 4),
          "earRight": round(earR_s, 4),
          "blink": bool(blink),
          "eyeContact": bool(contact_s > 0.5),
          "eyeContactPct": round(eye_contact_pct, 3),
          "gazeVector": [round(gx, 3), round(gy, 3)],
          "conf": round(conf, 3)
        }))
    except WebSocketDisconnect:
      return