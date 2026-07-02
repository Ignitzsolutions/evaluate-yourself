#!/bin/bash
# Deterministic backend test entrypoint (repo-root safe)

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${ROOT_DIR}"

if ! command -v uv >/dev/null 2>&1; then
  echo "❌ uv is required to run backend tests."
  echo "Install it with: curl -LsSf https://astral.sh/uv/install.sh | sh"
  exit 1
fi

echo "🧪 Syncing Python dependencies with uv..."
uv sync --frozen

echo "🧪 Running backend tests with uv"
uv run pytest backend/tests "$@"
