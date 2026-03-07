"""Pytest path normalization for mixed import styles in backend tests."""

from __future__ import annotations

import sys
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
BACKEND_ROOT = REPO_ROOT / "backend"

for _path in (str(REPO_ROOT), str(BACKEND_ROOT)):
    if _path not in sys.path:
        sys.path.insert(0, _path)
