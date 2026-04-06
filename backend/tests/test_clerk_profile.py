from types import SimpleNamespace

import backend.services.clerk_profile as clerk_profile


def test_fetch_clerk_contact_fields_uses_only_primary_verified_contacts(monkeypatch):
    payload = {
        "primary_email_address_id": "email_primary",
        "primary_phone_number_id": "phone_primary",
        "email_addresses": [
            {
                "id": "email_primary",
                "email_address": "User@Example.com",
                "verification": {"status": "verified"},
            },
            {
                "id": "email_other",
                "email_address": "other@example.com",
                "verification": {"status": "unverified"},
            },
        ],
        "phone_numbers": [
            {
                "id": "phone_primary",
                "phone_number": "+91 98765 43210",
                "verification": {"status": "verified"},
            }
        ],
        "first_name": "Sonia",
        "last_name": "AI",
    }

    def fake_get(*args, **kwargs):
        return SimpleNamespace(
            status_code=200,
            content=b'{"ok": true}',
            raise_for_status=lambda: None,
            json=lambda: payload,
        )

    monkeypatch.setenv("CLERK_SECRET_KEY", "sk_test_example")
    monkeypatch.setattr(clerk_profile.requests, "get", fake_get)

    profile = clerk_profile.fetch_clerk_contact_fields("user_123")

    assert profile["email"] == "user@example.com"
    assert profile["email_verified"] is True
    assert profile["phone_e164"] == "+919876543210"
    assert profile["phone_verified"] is True
    assert profile["full_name"] == "Sonia AI"


def test_fetch_clerk_contact_fields_ignores_unverified_primary_contacts(monkeypatch):
    payload = {
        "primary_email_address_id": "email_primary",
        "primary_phone_number_id": "phone_primary",
        "email_addresses": [
            {
                "id": "email_primary",
                "email_address": "user@example.com",
                "verification": {"status": "unverified"},
            },
            {
                "id": "email_other",
                "email_address": "verified@example.com",
                "verification": {"status": "verified"},
            },
        ],
        "phone_numbers": [
            {
                "id": "phone_primary",
                "phone_number": "+91 99999 00000",
                "verification": {"status": "failed"},
            },
            {
                "id": "phone_other",
                "phone_number": "+91 88888 11111",
                "verification": {"status": "verified"},
            },
        ],
    }

    def fake_get(*args, **kwargs):
        return SimpleNamespace(
            status_code=200,
            content=b'{"ok": true}',
            raise_for_status=lambda: None,
            json=lambda: payload,
        )

    monkeypatch.setenv("CLERK_SECRET_KEY", "sk_test_example")
    monkeypatch.setattr(clerk_profile.requests, "get", fake_get)

    profile = clerk_profile.fetch_clerk_contact_fields("user_123")

    assert profile["email"] == "verified@example.com"
    assert profile["email_verified"] is True
    assert profile["phone_e164"] == "+918888811111"
    assert profile["phone_verified"] is True
