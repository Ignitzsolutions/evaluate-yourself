#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

echo "==> Pulling latest changes"
git --no-pager pull --ff-only

if [[ ! -f backend/.env ]]; then
  echo "backend/.env missing. Copy backend/.env.example to backend/.env and update secrets first."
  exit 1
fi

echo "==> Building and starting services"
docker compose up -d --build

echo "==> Deployment status"
docker compose ps

echo "==> Health check"
curl -fsS http://localhost/health | cat
