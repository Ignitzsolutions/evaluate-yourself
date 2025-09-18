@echo off
REM run_server.bat - Easy startup script for Windows

echo 🚀 Starting Eye Tracking Server...
echo ==================================

REM Check if virtual environment exists
if not exist ".venv" (
    echo ❌ Virtual environment not found. Run setup first:
    echo    python -m venv .venv
    echo    .venv\Scripts\activate
    echo    pip install -r requirements.txt
    pause
    exit /b 1
)

REM Check if model file exists
if not exist "models\shape_predictor_68_face_landmarks.dat" (
    echo ⚠️  Model file not found!
    echo    Download from: http://dlib.net/files/shape_predictor_68_face_landmarks.dat.bz2
    echo    Extract to: models\shape_predictor_68_face_landmarks.dat
    echo.
    echo    Or use: curl -o models/shape_predictor_68_face_landmarks.dat.bz2 http://dlib.net/files/shape_predictor_68_face_landmarks.dat.bz2
    echo    Then extract the .bz2 file
    echo.
)

REM Activate virtual environment and start server
echo 📦 Activating virtual environment...
call .venv\Scripts\activate

echo 🔧 Starting FastAPI server on http://localhost:8000
echo 📊 WebSocket endpoint: ws://localhost:8000/ws
echo 📚 API docs: http://localhost:8000/docs
echo.
echo Press Ctrl+C to stop the server
echo.

uvicorn server:app --host 0.0.0.0 --port 8000 --reload