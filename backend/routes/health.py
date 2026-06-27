"""Health route extracted from app.py to keep the app module focused."""

from __future__ import annotations

import os

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from db.database import test_db_connection
from db.redis_client import test_redis_connection

router = APIRouter()


@router.get("/health")
def health_check():
    db_ok, db_message, db_latency_ms = test_db_connection()
    redis_ok, redis_message, redis_latency_ms = test_redis_connection()
    openai_key = os.getenv("OPENAI_API_KEY") or os.getenv("OPENAI_REALTIME_API_KEY")
    openai_ok = bool(openai_key and openai_key != "your-openai-api-key-here")

    payload = {
        "status": "healthy" if (db_ok and redis_ok and openai_ok) else "degraded",
        "components": {
            "openai": {
                "ok": openai_ok,
                "message": "OPENAI_API_KEY configured" if openai_ok else "OPENAI_API_KEY missing",
            },
            "database": {
                "ok": db_ok,
                "message": db_message,
                "latency_ms": round(db_latency_ms, 2),
            },
            "redis": {
                "ok": redis_ok,
                "message": redis_message,
                "latency_ms": round(redis_latency_ms, 2),
            },
        },
    }
    status_code = 200 if payload["status"] == "healthy" else 503
    return JSONResponse(status_code=status_code, content=payload)
