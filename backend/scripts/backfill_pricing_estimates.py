"""Best-effort backfill of `llm_usage_events` rows from historical session data.

Walks recent InterviewSession + InterviewReport records and emits a single
synthetic usage event per session using the configured default model and
the recorded duration. This is approximate — use it once after deploying
the new tables so the admin dashboard has non-empty spend history while
real instrumentation accumulates.

Usage:
    python -m scripts.backfill_pricing_estimates --days 30 --dry-run
    python -m scripts.backfill_pricing_estimates --days 30
"""

from __future__ import annotations

import argparse
import logging
import os
import sys
import uuid
from datetime import datetime, timedelta, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

from db.database import SessionLocal  # noqa: E402
from db import models  # noqa: E402
from services.observability.pricing import estimate_cost_micro_usd  # noqa: E402

logger = logging.getLogger("backfill_pricing")

# Conservative defaults — adjust if your deployment uses different models.
DEFAULT_CHAT_MODEL = os.getenv("DEFAULT_CHAT_MODEL", "gpt-4o-mini")
DEFAULT_REALTIME_MODEL = os.getenv("DEFAULT_REALTIME_MODEL", "gpt-4o-realtime-preview")

# Per-session approximations (no real telemetry available).
APPROX_PROMPT_TOKENS_PER_SESSION = 4000
APPROX_COMPLETION_TOKENS_PER_SESSION = 1500
APPROX_REALTIME_SECONDS_PER_SESSION = 900  # 15 min avg


def _has_existing_usage(db, since: datetime) -> bool:
    return db.query(models.LLMUsageEvent).filter(models.LLMUsageEvent.created_at >= since).limit(1).count() > 0


def backfill(days: int, dry_run: bool) -> int:
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    db = SessionLocal()
    created = 0
    try:
        if _has_existing_usage(db, cutoff):
            logger.warning("Found existing usage events in the window — backfill is additive, not a reset.")

        sessions = (
            db.query(models.InterviewSession)
            .filter(models.InterviewSession.created_at >= cutoff)
            .all()
        )
        logger.info("Found %d sessions in the last %d days", len(sessions), days)

        for sess in sessions:
            for kind, model_name, pt, ct, ais in (
                ("chat", DEFAULT_CHAT_MODEL, APPROX_PROMPT_TOKENS_PER_SESSION,
                 APPROX_COMPLETION_TOKENS_PER_SESSION, 0),
                ("realtime_audio", DEFAULT_REALTIME_MODEL, 0, 0,
                 APPROX_REALTIME_SECONDS_PER_SESSION),
            ):
                cost = estimate_cost_micro_usd(
                    model_name,
                    prompt_tokens=pt, completion_tokens=ct,
                    audio_input_seconds=ais,
                )
                event = models.LLMUsageEvent(
                    id=str(uuid.uuid4()),
                    user_id=getattr(sess, "candidate_id", None),
                    session_id=getattr(sess, "id", None),
                    route=("orchestrator" if kind == "chat" else "realtime"),
                    provider="openai",
                    model=model_name,
                    kind=kind,
                    prompt_tokens=pt,
                    completion_tokens=ct,
                    total_tokens=pt + ct,
                    audio_input_seconds=ais,
                    est_cost_usd_micro=cost,
                    created_at=getattr(sess, "created_at", None) or datetime.now(timezone.utc),
                )
                if not dry_run:
                    db.add(event)
                created += 1
        if dry_run:
            db.rollback()
            logger.info("Dry-run: would have created %d events", created)
        else:
            db.commit()
            logger.info("Inserted %d backfilled usage events", created)
    finally:
        db.close()
    return created


def main() -> int:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
    parser = argparse.ArgumentParser(description="Backfill llm_usage_events from historical sessions.")
    parser.add_argument("--days", type=int, default=30, help="Look-back window in days (default 30).")
    parser.add_argument("--dry-run", action="store_true", help="Compute counts without writing.")
    args = parser.parse_args()
    n = backfill(days=args.days, dry_run=args.dry_run)
    print(f"events_{'planned' if args.dry_run else 'created'}={n}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
