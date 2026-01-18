#!/bin/bash
# Start Backend Server Script

set -e

echo "🚀 Starting Backend Server..."
echo "=============================="

# Check if we're in the right directory
if [ ! -d "backend" ]; then
    echo "❌ Error: backend directory not found. Run this script from the project root."
    exit 1
fi

# Check if virtual environment exists
if [ ! -d ".venv" ]; then
    echo "⚠️  Virtual environment not found. Creating one..."
    python3 -m venv .venv
    echo "✅ Virtual environment created"
fi

# Activate virtual environment
echo "📦 Activating virtual environment..."
source .venv/bin/activate

# Check if .env file exists
if [ ! -f "backend/.env" ]; then
    echo "⚠️  Warning: backend/.env file not found."
    echo "   Creating from .env.example..."
    if [ -f "backend/.env.example" ]; then
        cp backend/.env.example backend/.env
        echo "   Please edit backend/.env and add your Azure OpenAI keys"
    else
        echo "   Please create backend/.env with your configuration"
    fi
fi

# Install/update dependencies
echo "📥 Checking dependencies..."
pip install -q -r backend/requirements.txt || {
    echo "❌ Failed to install dependencies"
    exit 1
}

# Check if port 8000 is in use
if lsof -Pi :8000 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
    echo "⚠️  Port 8000 is already in use."
    echo "   Trying to use port 8001 instead..."
    PORT=8001
else
    PORT=8000
fi

# Change to backend directory
cd backend

echo ""
echo "🔧 Starting FastAPI server on http://localhost:${PORT}"
echo "📊 WebSocket endpoint: ws://localhost:${PORT}/ws"
echo "📚 API docs: http://localhost:${PORT}/docs"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

# Start uvicorn
uvicorn app:app --host 0.0.0.0 --port ${PORT} --reload
