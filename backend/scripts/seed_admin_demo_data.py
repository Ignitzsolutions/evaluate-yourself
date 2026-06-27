#!/usr/bin/env python3
"""Seed realistic-looking LLM usage + auth audit data for the admin dashboard demo.

Usage:
  python backend/scripts/seed_admin_demo_data.py [--days 14] [--per-day 60] [--wipe]
"""
from __future__ import annotations

import argparse
import json
import random
import sys
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
ROOT_DIR = BACKEND_DIR.parent
for p in (str(ROOT_DIR), str(BACKEND_DIR)):
    if p not in sys.path:
        sys.path.insert(0, p)

from backend.db.database import SessionLocal  # noqa: E402
from backend.db.models import (  # noqa: E402
    AuthAuditEvent,
    LLMUsageEvent,
    User,
)


DEMO_USERS = [
    ("u-anika", "anika.rao@acme.dev", "Anika Rao"),
    ("u-marcus", "marcus.lee@acme.dev", "Marcus Lee"),
    ("u-priya", "priya.shah@acme.dev", "Priya Shah"),
    ("u-jordan", "jordan.kim@acme.dev", "Jordan Kim"),
    ("u-sasha", "sasha.ito@acme.dev", "Sasha Ito"),
    ("u-rafael", "rafael.diaz@acme.dev", "Rafael Diaz"),
]

# (model, kind, route, weight)
PROFILE = [
    ("gpt-4o-realtime-preview", "realtime_audio", "realtime", 30),
    ("gpt-4o-mini", "chat", "scoring", 22),
    ("gpt-4o-mini", "chat", "orchestrator", 18),
    ("gpt-4o-mini-transcribe", "chat", "transcribe", 10),
    ("gpt-4o-mini", "chat", "practice", 14),
    ("text-embedding-3-small", "embedding", "retrieval", 6),
]

# Rough $/1M tokens for est_cost (input + output blended).
MODEL_COST_USD_PER_M = {
    "gpt-4o-realtime-preview": 22.0,
    "gpt-4o-mini": 0.45,
    "gpt-4o-mini-transcribe": 0.50,
    "text-embedding-3-small": 0.02,
}


def weighted_pick(profile):
    total = sum(w for *_, w in profile)
    r = random.uniform(0, total)
    acc = 0.0
    for *vals, w in profile:
        acc += w
        if r <= acc:
            return tuple(vals)
    return tuple(profile[-1][:-1])


def ensure_users(db):
    for uid, email, name in DEMO_USERS:
        u = db.query(User).filter(User.id == uid).first()
        if not u:
            db.add(
                User(
                    id=uid,
                    clerk_user_id=uid,
                    email=email,
                    full_name=name,
                    is_active=True,
                    is_deleted=False,
                    is_admin=False,
                    email_verified=True,
                    created_at=datetime.now(timezone.utc) - timedelta(days=30),
                )
            )
    db.commit()


def synth_event(now: datetime) -> LLMUsageEvent:
    model, kind, route = weighted_pick(PROFILE)
    uid, email, _ = random.choice(DEMO_USERS)

    if kind == "realtime_audio":
        audio_in = random.randint(20, 180)
        audio_out = random.randint(20, 180)
        prompt = audio_in * 50
        completion = audio_out * 50
    elif kind == "embedding":
        audio_in = audio_out = 0
        prompt = random.randint(200, 2000)
        completion = 0
    else:
        audio_in = audio_out = 0
        prompt = random.randint(400, 3500)
        completion = random.randint(200, 1500)

    total = prompt + completion
    rate = MODEL_COST_USD_PER_M.get(model, 0.5)
    cost_usd = (total / 1_000_000.0) * rate
    cost_micro = int(round(cost_usd * 1_000_000))

    return LLMUsageEvent(
        id=str(uuid.uuid4()),
        user_id=uid,
        clerk_user_id=uid,
        session_id=f"sess-{random.randint(1000, 9999)}",
        route=route,
        provider="openai",
        model=model,
        kind=kind,
        prompt_tokens=prompt,
        completion_tokens=completion,
        total_tokens=total,
        audio_input_seconds=audio_in,
        audio_output_seconds=audio_out,
        est_cost_usd_micro=cost_micro,
        latency_ms=random.randint(180, 4200),
        created_at=now,
    )


def synth_audit(now: datetime) -> AuthAuditEvent:
    uid, email, _ = random.choice(DEMO_USERS)
    et, outcome = random.choice(
        [
            ("login_success", "success"),
            ("login_success", "success"),
            ("login_success", "success"),
            ("login_failure", "failure"),
            ("mfa_pass", "success"),
            ("mfa_fail", "failure"),
            ("token_revoke", "success"),
            ("account_locked", "failure"),
            ("password_change", "success"),
        ]
    )
    return AuthAuditEvent(
        id=str(uuid.uuid4()),
        user_id=uid,
        email=email,
        event_type=et,
        outcome=outcome,
        ip_address=f"10.0.{random.randint(1, 254)}.{random.randint(1, 254)}",
        user_agent=random.choice(
            [
                "Mozilla/5.0 (Macintosh; Intel Mac OS X) Chrome/130",
                "Mozilla/5.0 (Windows NT 10.0) Firefox/132",
                "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0) Safari",
            ]
        ),
        detail=json.dumps({"source": "demo-seed"}),
        created_at=now,
    )


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--days", type=int, default=14)
    ap.add_argument("--per-day", type=int, default=60)
    ap.add_argument("--audit-per-day", type=int, default=8)
    ap.add_argument("--wipe", action="store_true", help="Delete existing demo rows first")
    args = ap.parse_args()

    db = SessionLocal()
    try:
        ensure_users(db)

        if args.wipe:
            db.query(LLMUsageEvent).delete()
            db.query(AuthAuditEvent).delete()
            db.commit()
            print("wiped existing llm_usage_events + auth_audit_events")

        now = datetime.now(timezone.utc)
        usage_rows, audit_rows = 0, 0

        for day_offset in range(args.days):
            day_factor = 1.0 + 0.5 * random.random() + (0.6 if day_offset < 3 else 0)
            n_usage = max(1, int(args.per_day * day_factor))
            for _ in range(n_usage):
                # Spread across the day, business hours weighted
                hour = random.choices(
                    range(24),
                    weights=[1, 1, 1, 1, 1, 2, 3, 5, 7, 8, 9, 9, 8, 9, 9, 8, 7, 6, 5, 4, 3, 2, 2, 1],
                )[0]
                minute = random.randint(0, 59)
                ts = (now - timedelta(days=day_offset)).replace(hour=hour, minute=minute, second=random.randint(0, 59), microsecond=0)
                db.add(synth_event(ts))
                usage_rows += 1

            for _ in range(args.audit_per_day):
                ts = (now - timedelta(days=day_offset)) - timedelta(minutes=random.randint(0, 1440))
                db.add(synth_audit(ts))
                audit_rows += 1

            db.commit()

        # Add a couple of very recent events so "today" KPI moves
        for _ in range(12):
            ts = now - timedelta(minutes=random.randint(0, 90))
            db.add(synth_event(ts))
        db.commit()

        print(f"seeded {usage_rows + 12} usage events and {audit_rows} audit events")
        # Quick sanity totals
        from sqlalchemy import func as _f
        total = db.query(_f.count(LLMUsageEvent.id)).scalar()
        cost_micro = db.query(_f.coalesce(_f.sum(LLMUsageEvent.est_cost_usd_micro), 0)).scalar()
        print(f"usage rows in db: {total}, total est spend: ${cost_micro / 1_000_000:.2f}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
