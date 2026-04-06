"""Simple in-memory LRU cache for LLM evaluation calls.

Prevents duplicate LLM calls for the same (question, answer) pairs.
Used by star_extractor.py and semantic_scorer.py.
"""

from __future__ import annotations

import hashlib
import time
from collections import OrderedDict
from typing import Any, Optional


_CACHE_MAX = 1000
_CACHE_TTL = 3600  # 1 hour

_cache: OrderedDict[str, tuple[Any, float]] = OrderedDict()
_hits = 0
_misses = 0


def _cache_key(*parts: str) -> str:
    raw = "\x00".join(p or "" for p in parts)
    return hashlib.sha256(raw.encode()).hexdigest()[:32]


def get(namespace: str, *key_parts: str) -> Optional[Any]:
    global _hits, _misses
    key = namespace + ":" + _cache_key(*key_parts)
    entry = _cache.get(key)
    if entry is None:
        _misses += 1
        return None
    value, ts = entry
    if time.time() - ts > _CACHE_TTL:
        del _cache[key]
        _misses += 1
        return None
    _cache.move_to_end(key)
    _hits += 1
    total = _hits + _misses
    if total % 100 == 0:
        ratio = round(_hits / total * 100)
        print(f"[llm_cache] hit_rate={ratio}% ({_hits}/{total})")
    return value


def put(namespace: str, value: Any, *key_parts: str) -> None:
    key = namespace + ":" + _cache_key(*key_parts)
    _cache[key] = (value, time.time())
    _cache.move_to_end(key)
    while len(_cache) > _CACHE_MAX:
        _cache.popitem(last=False)


def clear() -> None:
    _cache.clear()
