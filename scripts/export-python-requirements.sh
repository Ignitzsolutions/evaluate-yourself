#!/bin/bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

if ! command -v uv >/dev/null 2>&1; then
  echo "❌ uv is required to export requirements.txt"
  echo "Install it with: curl -LsSf https://astral.sh/uv/install.sh | sh"
  exit 1
fi

uv export \
  --frozen \
  --format requirements.txt \
  --no-dev \
  --no-group test \
  --no-editable \
  --no-emit-project \
  --no-hashes \
  --output-file requirements.txt

echo "✓ Exported requirements.txt from uv.lock"
