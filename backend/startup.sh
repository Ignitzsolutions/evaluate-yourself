#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Ensure Oryx-built virtualenv is active when using a custom startup command.
# App Service typically builds a venv at /home/site/wwwroot/antenv.
if [ -n "${ORYX_VIRTUAL_ENV:-}" ] && [ -d "${ORYX_VIRTUAL_ENV:-}" ]; then
  source "${ORYX_VIRTUAL_ENV}/bin/activate"
elif [ -d "/home/site/wwwroot/antenv" ]; then
  source "/home/site/wwwroot/antenv/bin/activate"
fi

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
exec gunicorn -k uvicorn.workers.UvicornWorker app:app --bind=0.0.0.0:${PORT:-8000}
