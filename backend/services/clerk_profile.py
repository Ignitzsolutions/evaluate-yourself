from __future__ import annotations

import os
import re
from typing import Any, Dict, Iterable, Optional

import requests


def _is_verified(item: Dict[str, Any]) -> bool:
    verification = item.get("verification") if isinstance(item, dict) else {}
    return str((verification or {}).get("status") or "").lower() == "verified"


def _pick_verified(items: Iterable[Dict[str, Any]], primary_id: Optional[str]) -> Optional[Dict[str, Any]]:
    rows = [item for item in items if isinstance(item, dict)]
    for item in rows:
        if item.get("id") == primary_id and _is_verified(item):
            return item
    for item in rows:
        if _is_verified(item):
            return item
    return None


def _normalize_email(value: Optional[str]) -> Optional[str]:
    raw = str(value or "").strip().lower()
    return raw or None


def _normalize_phone_e164(value: Optional[str]) -> Optional[str]:
    raw = str(value or "").strip()
    if not raw:
        return None
    digits = re.sub(r"\D+", "", raw)
    if raw.startswith("+"):
        return f"+{digits}" if digits else None
    return f"+{digits}" if digits else None


def fetch_clerk_contact_fields(clerk_user_id: str) -> Dict[str, Any]:
    secret_key = os.getenv("CLERK_SECRET_KEY", "").strip()
    if not secret_key:
        raise RuntimeError("CLERK_SECRET_KEY must be set.")

    response = requests.get(
        f"https://api.clerk.com/v1/users/{clerk_user_id}",
        headers={"Authorization": f"Bearer {secret_key}"},
        timeout=10,
    )
    response.raise_for_status()
    payload = response.json()

    email = _pick_verified(
        payload.get("email_addresses") or [],
        payload.get("primary_email_address_id"),
    )
    phone = _pick_verified(
        payload.get("phone_numbers") or [],
        payload.get("primary_phone_number_id"),
    )
    full_name = " ".join(
        part
        for part in [
            str(payload.get("first_name") or "").strip(),
            str(payload.get("last_name") or "").strip(),
        ]
        if part
    )

    return {
        "email": _normalize_email((email or {}).get("email_address")),
        "email_verified": email is not None,
        "phone_e164": _normalize_phone_e164((phone or {}).get("phone_number")),
        "phone_verified": phone is not None,
        "full_name": full_name or None,
    }
