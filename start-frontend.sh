#!/bin/bash
# Start Frontend Server Script

set -e

echo "🚀 Starting Frontend Server..."
echo "==============================="

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📥 Installing dependencies..."
    npm install
fi

# Check if .env exists (optional)
if [ ! -f ".env" ]; then
    echo "ℹ️  .env file not found (optional for frontend)"
fi

# Set PORT if not set
export PORT=${PORT:-3001}

# Check if port is in use
if lsof -Pi :${PORT} -sTCP:LISTEN -t >/dev/null 2>&1 ; then
    echo "❌ Port ${PORT} is already in use."
    echo "   Stop the existing process or choose a port explicitly:"
    echo "   PORT=3002 ./start-frontend.sh"
    exit 1
fi

echo ""
echo "🌐 Starting React development server on http://localhost:${PORT}"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

# Start React dev server
PORT=${PORT} npm start
