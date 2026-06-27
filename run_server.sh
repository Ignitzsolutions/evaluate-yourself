#!/bin/bash
# run_server.sh - Easy startup script for the consolidated backend server

echo "🚀 Starting Backend Server..."
echo "=================================="

# Check if virtual environment exists
if [ ! -d ".venv" ]; then
    echo "❌ Virtual environment not found. Run setup first:"
    echo "   python -m venv .venv"
    echo "   .venv\\Scripts\\activate  # Windows"
    echo "   source .venv/bin/activate  # Linux/Mac"
    echo "   pip install -r requirements.txt"
    exit 1
fi

# Activate virtual environment and start server
echo "📦 Activating virtual environment..."
if [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "win32" ]]; then
    # Windows
    source .venv/Scripts/activate
else
    # Linux/Mac
    source .venv/bin/activate
fi

echo "🔧 Starting FastAPI server on http://localhost:8000"
echo "📊 WebSocket endpoints: ws://localhost:8000/ws and ws://localhost:8000/ws/gaze/{session_id}"
echo "📚 API docs: http://localhost:8000/docs"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

uvicorn server:app --host 0.0.0.0 --port 8000 --reload