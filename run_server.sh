#!/bin/bash
# run_server.sh - Easy startup script for the eye-tracking server

echo "🚀 Starting Eye Tracking Server..."
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

# Check if model file exists
if [ ! -f "models/shape_predictor_68_face_landmarks.dat" ]; then
    echo "⚠️  Model file not found!"
    echo "   Download from: http://dlib.net/files/shape_predictor_68_face_landmarks.dat.bz2"
    echo "   Extract to: models/shape_predictor_68_face_landmarks.dat"
    echo ""
    echo "   Or use: curl -o models/shape_predictor_68_face_landmarks.dat.bz2 http://dlib.net/files/shape_predictor_68_face_landmarks.dat.bz2"
    echo "   Then extract the .bz2 file"
    echo ""
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
echo "📊 WebSocket endpoint: ws://localhost:8000/ws"
echo "📚 API docs: http://localhost:8000/docs"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

uvicorn server:app --host 0.0.0.0 --port 8000 --reload