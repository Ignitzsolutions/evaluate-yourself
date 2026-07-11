#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -ne 3 ]; then
  echo "Usage: $0 <release-bundle.tar.gz> <backend-env-file> <deploy-path>" >&2
  exit 1
fi

BUNDLE_PATH="$1"
ENV_FILE_PATH="$2"
DEPLOY_PATH="$3"
RELEASES_DIR="${DEPLOY_PATH}/releases"
SHARED_DIR="${DEPLOY_PATH}/shared"
CURRENT_LINK="${DEPLOY_PATH}/current"
TIMESTAMP="$(date +%Y%m%d%H%M%S)"
RELEASE_DIR="${RELEASES_DIR}/${TIMESTAMP}"

if ! command -v docker >/dev/null 2>&1; then
  echo "docker is required on the target server" >&2
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "docker compose plugin is required on the target server" >&2
  exit 1
fi

mkdir -p "${RELEASES_DIR}" "${SHARED_DIR}"
rm -rf "${RELEASE_DIR}"
mkdir -p "${RELEASE_DIR}"

tar -xzf "${BUNDLE_PATH}" -C "${RELEASE_DIR}"
cp "${ENV_FILE_PATH}" "${RELEASE_DIR}/backend/.env"

ln -sfn "${RELEASE_DIR}" "${CURRENT_LINK}"
cd "${CURRENT_LINK}"

docker compose up -d --build --remove-orphans
docker compose exec -T backend bash -lc 'cd /app/backend && uv run python -m alembic -c alembic.ini upgrade head && uv run python scripts/schema_smoke.py'

find "${RELEASES_DIR}" -mindepth 1 -maxdepth 1 -type d | sort | head -n -3 | xargs -r rm -rf

echo "Deployment complete: ${RELEASE_DIR}"
