@echo off
REM run_server.bat - Easy startup script for Windows

echo 🚀 Starting Backend Server...
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

REM Activate virtual environment and start server
echo 📦 Activating virtual environment...
call .venv\Scripts\activate

echo 🔧 Starting FastAPI server on http://localhost:8000
echo 📊 WebSocket endpoints: ws://localhost:8000/ws and ws://localhost:8000/ws/gaze/{session_id}
echo 📚 API docs: http://localhost:8000/docs
echo.
echo Press Ctrl+C to stop the server
echo.

uvicorn server:app --host 0.0.0.0 --port 8000 --reload