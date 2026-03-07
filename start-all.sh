#!/bin/bash
# Start Both Frontend and Backend Servers

set -e

echo "🚀 Starting Evaluate Yourself Application"
echo "=========================================="
echo ""

BACKEND_HOST=${BACKEND_HOST:-127.0.0.1}
BACKEND_PORT=${BACKEND_PORT:-8000}
BACKEND_BASE_URL=${BACKEND_BASE_URL:-http://${BACKEND_HOST}:${BACKEND_PORT}}
FRONTEND_PORT=${FRONTEND_PORT:-3001}

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "🛑 Shutting down servers..."
    if [ -n "${BACKEND_PID:-}" ]; then
        kill "$BACKEND_PID" 2>/dev/null || true
    fi
    if [ -n "${FRONTEND_PID:-}" ]; then
        kill "$FRONTEND_PID" 2>/dev/null || true
    fi
    exit
}

trap cleanup SIGINT SIGTERM

wait_for_backend() {
    local retries=30
    local attempt=1
    while [ "$attempt" -le "$retries" ]; do
        if curl -sSf "${BACKEND_BASE_URL}/health" >/dev/null 2>&1; then
            return 0
        fi
        sleep 1
        attempt=$((attempt + 1))
    done
    return 1
}

check_endpoint() {
    local path="$1"
    local accepted_codes="$2"
    local tmp_body="/tmp/startall_smoke_body.txt"
    local code
    code=$(curl -s -o "$tmp_body" -w "%{http_code}" "${BACKEND_BASE_URL}${path}" || true)
    IFS=',' read -r -a expected <<< "$accepted_codes"
    for item in "${expected[@]}"; do
        if [ "$code" = "$item" ]; then
            echo "   ✅ ${path} -> ${code}"
            return 0
        fi
    done
    echo "   ❌ ${path} -> ${code} (expected one of: ${accepted_codes})"
    head -c 200 "$tmp_body" 2>/dev/null || true
    echo ""
    return 1
}

run_backend_smoke() {
    echo "🧪 Running backend startup smoke checks..."
    check_endpoint "/health" "200"
    check_endpoint "/api/profile/status" "200,401"
    check_endpoint "/api/interview/skill-catalog" "200,401"
    check_endpoint "/openapi.json" "200"

    local openapi_tmp="/tmp/startall_openapi.json"
    curl -sSf "${BACKEND_BASE_URL}/openapi.json" > "$openapi_tmp"
    if ! grep -q "/api/admin/dashboard/overview" "$openapi_tmp"; then
        echo "   ❌ /openapi.json missing /api/admin/dashboard/overview"
        return 1
    fi
    if ! grep -q "/api/admin/question-bank/tracks" "$openapi_tmp"; then
        echo "   ❌ /openapi.json missing /api/admin/question-bank/tracks"
        return 1
    fi
    echo "   ✅ Admin OpenAPI routes detected"
}

# Start backend in background
echo "📦 Starting backend server..."
./start-backend.sh > backend.log 2>&1 &
BACKEND_PID=$!
echo "   Backend PID: $BACKEND_PID"
echo "   Logs: backend.log"

# Check if backend started successfully
if ! kill -0 $BACKEND_PID 2>/dev/null; then
    echo "❌ Backend failed to start. Check backend.log for errors."
    exit 1
fi

if ! wait_for_backend; then
    echo "❌ Backend did not become healthy at ${BACKEND_BASE_URL}/health."
    echo "   Check backend.log for startup errors."
    kill "$BACKEND_PID" 2>/dev/null || true
    exit 1
fi

if ! run_backend_smoke; then
    echo "❌ Backend startup smoke checks failed."
    kill "$BACKEND_PID" 2>/dev/null || true
    exit 1
fi

# Start frontend in background
echo "🌐 Starting frontend server..."
PORT=${FRONTEND_PORT} ./start-frontend.sh > frontend.log 2>&1 &
FRONTEND_PID=$!
echo "   Frontend PID: $FRONTEND_PID"
echo "   Logs: frontend.log"
sleep 3

# Check if frontend started successfully
if ! kill -0 $FRONTEND_PID 2>/dev/null; then
    echo "❌ Frontend failed to start. Check frontend.log for errors."
    kill $BACKEND_PID 2>/dev/null || true
    exit 1
fi

echo ""
echo "✅ Both servers are running!"
echo ""
echo "📊 Backend:  ${BACKEND_BASE_URL}"
echo "📚 API Docs: ${BACKEND_BASE_URL}/docs"
echo "🌐 Frontend: http://localhost:${FRONTEND_PORT}"
echo ""
echo "Press Ctrl+C to stop both servers"
echo ""

# Wait for both processes
wait $BACKEND_PID $FRONTEND_PID
