# Eye Tracking Server (Python FastAPI)

This is the Python backend server for real-time eye tracking using OpenCV and dlib. It processes webcam frames from the React frontend and returns eye contact metrics, blink detection, and gaze analysis.

## �️ Setup Environment

### Windows Users - Special Instructions for dlib

**dlib installation on Windows requires CMake. If you encounter build errors:**

#### Option 1: Install CMake (Recommended)
```bash
# Download and install CMake from: https://cmake.org/download/
# Make sure to add CMake to your PATH during installation

# Then install dlib:
pip install dlib
```

#### Option 2: Use Pre-compiled Wheels
```bash
# Try the conda-forge version:
conda install -c conda-forge dlib

# Or use a pre-compiled wheel:
pip install https://pypi.org/project/dlib/19.24.2/#files
```

#### Option 3: Use Alternative Face Detection
If dlib continues to fail, you can modify the server to use:
- **MediaPipe Face Mesh** (easier installation)
- **OpenCV DNN face detection** (built-in)

### Standard Installation

```bash
# Create virtual environment
python -m venv .venv

# Activate environment
# Windows:
.venv\Scripts\activate
# Linux/Mac:
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### 2. Download Model Files

**Required:** Download the dlib 68 face landmarks model:

```bash
# Download from official source
curl -o models/shape_predictor_68_face_landmarks.dat.bz2 http://dlib.net/files/shape_predictor_68_face_landmarks.dat.bz2

# Extract the file
# Windows: Use 7-Zip or WinRAR to extract
# Linux/Mac:
bunzip2 models/shape_predictor_68_face_landmarks.dat.bz2
```

**Alternative download:** https://github.com/davisking/dlib-models/raw/master/shape_predictor_68_face_landmarks.dat.bz2

### 3. Run the Server

```bash
# Start the FastAPI server
uvicorn server:app --host 0.0.0.0 --port 8000

# Or with auto-reload during development
uvicorn server:app --host 0.0.0.0 --port 8000 --reload
```

The server will be available at:
- **WebSocket endpoint:** `ws://localhost:8000/ws`
- **API docs:** `http://localhost:8000/docs` (FastAPI automatic docs)

## 📊 Features

### Real-time Eye Tracking Metrics

The server processes webcam frames and returns:

- **Eye Contact Detection:** ✅/⚠️ based on gaze direction and confidence
- **Blink Detection:** Using Eye Aspect Ratio (EAR) analysis
- **Gaze Vector:** Normalized gaze direction (-1 to 1)
- **Confidence Score:** Pupil detection confidence (0-1)
- **Rolling Statistics:** Eye contact percentage over time

### Technical Details

- **Frame Rate:** Processes 5-10 FPS (configurable in React client)
- **Resolution:** Optimized for 320×240 compressed JPEG frames
- **Face Detection:** dlib frontal face detector
- **Landmark Detection:** 68-point facial landmarks
- **Eye Analysis:** Custom EAR calculation with EMA smoothing
- **Gaze Estimation:** Pupil center detection with contour analysis

## 🔧 Configuration

### Tuning Parameters (in server.py)

```python
# Blink detection threshold
EAR_BLINK_THRESHOLD = 0.21  # Lower = more sensitive

# Gaze threshold for eye contact
GAZE_MAG_THRESHOLD = 0.55   # Lower = stricter eye contact

# Minimum confidence for valid detection
MIN_CONFIDENCE = 0.15       # Higher = more reliable
```

### Performance Optimization

- **Frame Rate:** Adjust in React client (`WebcamToGaze.js`)
- **JPEG Quality:** Balance bandwidth vs. accuracy (0.5-0.7 recommended)
- **Resolution:** 320×240 provides good balance of speed vs. accuracy

## 🧪 Testing

### 1. Start the React App

```bash
npm start
```

### 2. Navigate to Interview Page

Go to `http://localhost:3002/interview`

### 3. Test Eye Tracking

1. **Grant camera permissions** when prompted
2. **Click "Connect"** to establish WebSocket connection
3. **Click "Start"** to begin eye tracking
4. **Monitor metrics** in real-time:
   - Eye contact status (✅/⚠️)
   - EAR values for both eyes
   - Blink detection
   - Confidence score

## 🏗️ Architecture

### WebSocket Protocol

**Client → Server:**
```json
{
  "type": "frame",
  "data": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQ..."
}
```

**Server → Client:**
```json
{
  "t": 1640995200000,
  "earLeft": 0.2345,
  "earRight": 0.2312,
  "blink": false,
  "eyeContact": true,
  "eyeContactPct": 0.856,
  "gazeVector": [0.123, -0.045],
  "conf": 0.789
}
```

### Processing Pipeline

1. **Receive JPEG frame** via WebSocket
2. **Decode base64** → OpenCV image
3. **Face detection** using dlib
4. **Landmark extraction** (68 points)
5. **Eye isolation** (left/right eye points)
6. **EAR calculation** for blink detection
7. **Pupil detection** for gaze estimation
8. **Smoothing** with EMA filters
9. **Threshold analysis** for eye contact
10. **Send metrics** back to client

## 🚀 Deployment

### Production Setup

1. **Use a production ASGI server:**
   ```bash
   pip install gunicorn
   gunicorn server:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
   ```

2. **Add reverse proxy (nginx):**
   ```nginx
   location /ws {
       proxy_pass http://127.0.0.1:8000;
       proxy_http_version 1.1;
       proxy_set_header Upgrade $http_upgrade;
       proxy_set_header Connection "upgrade";
       proxy_set_header Host $host;
       proxy_set_header X-Real-IP $remote_addr;
       proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
       proxy_set_header X-Forwarded-Proto $scheme;
   }
   ```

3. **SSL/TLS:** Use wss:// for secure WebSocket connections

### Environment Variables

```bash
# Production settings
export HOST=0.0.0.0
export PORT=8000
export WORKERS=4
```

## 🔍 Troubleshooting

### Common Issues

1. **"Module not found" errors:**
   - Ensure virtual environment is activated
   - Run `pip install -r requirements.txt`

2. **Model file not found:**
   - Verify `models/shape_predictor_68_face_landmarks.dat` exists
   - Check file permissions

3. **Camera not working:**
   - Grant camera permissions in browser
   - Check if camera is being used by another application

4. **Poor eye tracking:**
   - Improve lighting conditions
   - Adjust camera angle for better face detection
   - Tune thresholds in server.py

### Performance Tips

- **CPU Usage:** Reduce frame rate if server is slow
- **Memory:** Monitor for memory leaks in long-running sessions
- **Network:** Use WebSocket compression for better performance

## 📈 Monitoring

### Health Check

```bash
curl http://localhost:8000/docs
```

### Logs

The server outputs processing statistics and error messages to console.

## 🤝 Contributing

1. Test changes with the React frontend
2. Update documentation for any new features
3. Follow the existing code style and patterns

## 📄 License

This project is part of the "Evaluate Yourself" AI recruitment platform.