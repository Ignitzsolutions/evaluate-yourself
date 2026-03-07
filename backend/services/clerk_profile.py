import logging
import os
import re
from typing import Dict, Optional

import requests


def normalize_phone_e164(raw_phone: Optional[str]) -> Optional[str]:
    if not raw_phone:
        return None
    cleaned = re.sub(r"[^\d+]", "", str(raw_phone).strip())
    if not cleaned:
        return None
    if cleaned.startswith("+"):
        digits = "+" + re.sub(r"\D", "", cleaned[1:])
    else:
        digits = "+" + re.sub(r"\D", "", cleaned)
    if len(digits) < 8 or len(digits) > 17:
        return None
    return digits


def _pick_primary_email(payload: Dict) -> Optional[str]:
    primary_id = payload.get("primary_email_address_id")
    emails = payload.get("email_addresses") or []
    if primary_id:
        for item in emails:
            if item.get("id") == primary_id and item.get("email_address"):
                return str(item.get("email_address")).strip().lower()
    for item in emails:
        email = item.get("email_address")
        if email:
            return str(email).strip().lower()
    return None


def _pick_primary_phone(payload: Dict) -> Optional[str]:
    primary_id = payload.get("primary_phone_number_id")
    numbers = payload.get("phone_numbers") or []
    if primary_id:
        for item in numbers:
            if item.get("id") == primary_id and item.get("phone_number"):
                return normalize_phone_e164(item.get("phone_number"))
    for item in numbers:
        number = item.get("phone_number")
        if number:
            return normalize_phone_e164(number)
    return None


def _pick_full_name(payload: Dict) -> Optional[str]:
    first_name = (payload.get("first_name") or "").strip()
    last_name = (payload.get("last_name") or "").strip()
    if first_name or last_name:
        return f"{first_name} {last_name}".strip()
    full_name = (payload.get("full_name") or "").strip()
    if full_name:
        return full_name
    username = (payload.get("username") or "").strip()
    if username:
        return username
    return None


def fetch_clerk_contact_fields(clerk_user_id: str) -> Dict[str, Optional[str]]:
    secret = (os.getenv("CLERK_SECRET_KEY") or "").strip()
    if not secret or not clerk_user_id:
        return {"email": None, "full_name": None, "phone_e164": None}

    api_base = (os.getenv("CLERK_API_BASE_URL") or "https://api.clerk.com/v1").rstrip("/")
    url = f"{api_base}/users/{clerk_user_id}"

    try:
        response = requests.get(
            url,
            headers={"Authorization": f"Bearer {secret}"},
            timeout=6,
        )
        if response.status_code == 404:
            return {"email": None, "full_name": None, "phone_e164": None}
        response.raise_for_status()
        payload = response.json() if response.content else {}
    except Exception as exc:
        logging.warning("Failed to fetch Clerk profile for %s: %s", clerk_user_id, exc)
        return {"email": None, "full_name": None, "phone_e164": None}

    return {
        "email": _pick_primary_email(payload),
        "full_name": _pick_full_name(payload),
        "phone_e164": _pick_primary_phone(payload),
    }

