#!/bin/bash
set -euo pipefail

cd /home/site/wwwroot/backend

# Run DB migrations on startup
if [ -n "${DATABASE_URL:-}" ]; then
  echo "Running Alembic migrations..."
  alembic -c alembic.ini upgrade head
else
  echo "DATABASE_URL not set; skipping migrations"
fi

# Start the app
exec gunicorn -k uvicorn.workers.UvicornWorker app:app --bind=0.0.0.0:${PORT:-8000}
