@echo off
REM Start Backend Server Script for Windows

echo Starting Backend Server...
echo ============================

REM Check if backend directory exists
if not exist "backend" (
    echo Error: backend directory not found. Run this script from the project root.
    pause
    exit /b 1
)

REM Check if virtual environment exists
if not exist ".venv" (
    echo Creating virtual environment...
    python -m venv .venv
    echo Virtual environment created
)

REM Activate virtual environment
echo Activating virtual environment...
call .venv\Scripts\activate

REM Check if .env file exists
if not exist "backend\.env" (
    echo Warning: backend\.env file not found.
    echo Creating from .env.example...
    if exist "backend\.env.example" (
        copy backend\.env.example backend\.env
        echo Please edit backend\.env and add your Azure OpenAI keys
    ) else (
        echo Please create backend\.env with your configuration
    )
)

REM Install/update dependencies
echo Checking dependencies...
pip install -q -r backend\requirements.txt
if errorlevel 1 (
    echo Failed to install dependencies
    pause
    exit /b 1
)

REM Change to backend directory
cd backend

echo.
echo Starting FastAPI server on http://localhost:8000
echo WebSocket endpoint: ws://localhost:8000/ws
echo API docs: http://localhost:8000/docs
echo.
echo Press Ctrl+C to stop the server
echo.

REM Start uvicorn
uvicorn app:app --host 0.0.0.0 --port 8000 --reload
