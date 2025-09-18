@echo off
REM run_server_simple.bat - Simple server without dlib dependency

echo 🚀 Starting Simple Eye Tracking Server (no dlib)...
echo =============================================

REM Check if virtual environment exists
if not exist ".venv" (
    echo ❌ Virtual environment not found. Run setup first:
    echo    python -m venv .venv
    echo    .venv\Scripts\activate
    echo    pip install -r requirements.txt
    pause
    exit /b 1
)

REM Activate virtual environment and start server
echo 📦 Activating virtual environment...
call .venv\Scripts\activate

echo 🔧 Starting simplified FastAPI server on http://localhost:8000
echo 📊 WebSocket endpoint: ws://localhost:8000/ws
echo 📚 API docs: http://localhost:8000/docs
echo.
echo Note: This is a simplified version without dlib dependency.
echo It uses basic OpenCV face detection with mock eye tracking data.
echo.
echo Press Ctrl+C to stop the server
echo.

python server_simple.py