#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

cd "${SCRIPT_DIR}"

# Run DB migrations on startup
if [ -n "${DATABASE_URL:-}" ]; then
  echo "Running Alembic migrations..."
  python -m alembic -c "${SCRIPT_DIR}/alembic.ini" upgrade head
  echo "Running schema smoke..."
  python "${SCRIPT_DIR}/scripts/schema_smoke.py"
else
  echo "DATABASE_URL not set; skipping migrations"
fi

# Start the app
# Workers: 2 * CPU cores + 1 (Gunicorn recommendation for async workers)
WORKERS="${GUNICORN_WORKERS:-$(( 2 * $(nproc --all 2>/dev/null || echo 1) + 1 ))}"
echo "Starting Gunicorn with ${WORKERS} workers..."

exec gunicorn \
  -k uvicorn.workers.UvicornWorker \
  app:app \
  --bind=0.0.0.0:${PORT:-8000} \
  --workers="${WORKERS}" \
  --timeout=120 \
  --graceful-timeout=30 \
  --access-logfile=- \
  --error-logfile=- \
  --log-level=info
