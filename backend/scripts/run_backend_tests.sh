#!/bin/bash
# Deterministic backend test entrypoint (repo-root safe)

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${ROOT_DIR}"

PY_BIN="${PYTHON_BIN:-${ROOT_DIR}/.venv/bin/python}"
if [ ! -x "${PY_BIN}" ]; then
  PY_BIN="python3"
fi

echo "🧪 Running backend tests with ${PY_BIN}"
"${PY_BIN}" -m pytest backend/tests "$@"
