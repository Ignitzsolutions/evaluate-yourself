from __future__ import annotations

from datetime import datetime

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend import app as app_module
from db.database import Base
from db import models


@pytest.fixture
def profile_client():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)

    with TestingSessionLocal() as db:
        user = models.User(
            id="user-profile-1",
            clerk_user_id="clerk-profile-1",
            email="profile@example.com",
            full_name="Profile Tester",
        )
        db.add(user)
        db.commit()

    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    def override_get_current_user():
        with TestingSessionLocal() as db:
            return db.query(models.User).filter(models.User.id == "user-profile-1").first()

    app_module.app.dependency_overrides[app_module.get_db] = override_get_db
    app_module.app.dependency_overrides[app_module.get_current_user] = override_get_current_user
    try:
        yield TestClient(app_module.app), TestingSessionLocal
    finally:
        app_module.app.dependency_overrides.clear()
        Base.metadata.drop_all(bind=engine)
        engine.dispose()


def test_canonical_profile_upsert_normalizes_fields_and_allows_optional_contact_consent(profile_client):
    client, SessionLocal = profile_client
    max_grad_year = datetime.utcnow().year + 6

    response = client.put(
        "/api/profile",
        json={
            "candidateType": "early_career",
            "stateCode": " ca ",
            "city": " San Francisco\x00 ",
            "countryCode": " us ",
            "region": " California ",
            "timezone": " America/Los_Angeles ",
            "universityName": "  Stanford\x00 University  ",
            "graduationYear": max_grad_year,
            "experienceLevel": " entry ",
            "primaryStream": " backend ",
            "targetRoles": [" Backend Engineer ", "", "\x00"],
            "targetCompanies": [" Startup "],
            "skillsSelfReported": [{"skill": " Python ", "rating": 4}, " SQL "],
            "seniority": " junior ",
            "yearsOfExperience": 2,
            "currentTitle": " Software Engineer ",
            "targetInterviewFormat": " technical ",
            "targetJobDescription": " Build APIs\x00 and services. ",
            "targetJobUrl": " https://example.com/jobs/1 ",
            "consentDataUse": True,
        },
    )

    assert response.status_code == 200
    profile = response.json()["profile"]
    assert profile["city"] == "San Francisco"
    assert profile["countryCode"] == "US"
    assert profile["region"] == "California"
    assert profile["timezone"] == "America/Los_Angeles"
    assert profile["universityName"] == "Stanford  University"
    assert profile["universityNormalized"] == "stanford university"
    assert profile["targetRoles"] == ["Backend Engineer"]
    assert profile["skillsSelfReported"] == [{"skill": "Python", "rating": 4}, "SQL"]
    assert profile["consentDataUse"] is True
    assert profile["consentContact"] is False

    with SessionLocal() as db:
        row = db.query(models.CandidateProfileV2).one()
        assert row.country_code == "US"
        assert row.consent_contact is False
        assert row.graduation_year == max_grad_year


def test_canonical_profile_rejects_out_of_range_graduation_year(profile_client):
    client, _ = profile_client

    response = client.put(
        "/api/profile",
        json={
            "candidateType": "student",
            "countryCode": "US",
            "targetRoles": ["Backend Engineer"],
            "graduationYear": 99999,
            "consentDataUse": True,
        },
    )

    assert response.status_code == 400
    assert "graduationYear must be between 1950" in response.json()["error"]["message"]


def test_canonical_profile_requires_data_use_consent(profile_client):
    client, _ = profile_client

    response = client.put(
        "/api/profile",
        json={
            "candidateType": "student",
            "targetRoles": ["Backend Engineer"],
            "consentDataUse": False,
            "consentContact": True,
        },
    )

    assert response.status_code == 400
    assert response.json()["error"]["message"] == "consentDataUse is required"


def test_canonical_profile_get_falls_back_to_legacy_profile_mapping(profile_client):
    client, SessionLocal = profile_client
    with SessionLocal() as db:
        db.add(
            models.UserProfile(
                clerk_user_id="clerk-profile-1",
                user_category="professional",
                primary_goal="job_search",
                target_roles='[" Backend Engineer "]',
                industries='[" SaaS "]',
                interview_timeline="soon",
                prep_intensity="medium",
                learning_style="practice",
                consent_data_use=True,
                current_role=" Platform Engineer ",
                experience_band="mid",
                management_scope="none",
                domain_expertise='[" Python "]',
                target_company_type="Startup",
                career_transition_intent="same_track",
                notice_period_band="30_days",
                career_comp_band="Growth",
                interview_urgency="high",
            )
        )
        db.commit()

    response = client.get("/api/profile")

    assert response.status_code == 200
    body = response.json()
    assert body["source"] == "legacy_mapped"
    assert body["profile"]["targetRoles"] == ["Backend Engineer"]
    assert body["profile"]["consentDataUse"] is True
