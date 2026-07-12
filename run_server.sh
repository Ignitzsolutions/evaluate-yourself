#!/bin/bash
# run_server.sh - Easy startup script for the consolidated backend server

echo "🚀 Starting Backend Server..."
echo "=================================="

if ! command -v uv >/dev/null 2>&1; then
    echo "❌ uv is required to run the backend."
    echo "   Install it with:"
    echo "   curl -LsSf https://astral.sh/uv/install.sh | sh"
    exit 1
fi

echo "📥 Syncing Python dependencies with uv..."
uv sync --frozen

echo "🔧 Starting FastAPI server on http://localhost:8000"
echo "📊 WebSocket endpoints: ws://localhost:8000/ws and ws://localhost:8000/ws/gaze/{session_id}"
echo "📚 API docs: http://localhost:8000/docs"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

uv run uvicorn server:app --host 0.0.0.0 --port 8000 --reload
