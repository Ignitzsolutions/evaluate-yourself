from backend.services.interview.skill_tracks import (
    derive_profile_default_tracks,
    question_matches_track,
    validate_selected_skills,
)


def test_validate_selected_skills_technical_requires_one_stream():
    selected, err = validate_selected_skills(
        "technical",
        ["python_sql_github_cloud"],
    )
    assert err is None
    assert selected == ["python_sql_github_cloud"]


def test_validate_selected_skills_mixed_requires_one_technical():
    selected, err = validate_selected_skills(
        "mixed",
        ["python_sql_github_cloud", "java_full_stack"],
    )
    assert err is not None
    assert selected == []

    selected, err = validate_selected_skills("mixed", ["java_full_stack"])
    assert err is None
    assert selected == ["java_full_stack"]


def test_derive_profile_default_tracks():
    technical = derive_profile_default_tracks(
        interview_type="technical",
        target_roles=["SDE"],
        domain_expertise=["Backend", "Cloud"],
    )
    assert technical
    assert len(technical) == 1

    mixed = derive_profile_default_tracks(
        interview_type="mixed",
        target_roles=["Data"],
        domain_expertise=["Cloud"],
    )
    assert len(mixed) == 1


def test_question_matches_track_by_domain_or_tags():
    q_backend = {"domain": "backend", "topic_tags": ["api", "auth"]}
    q_behavioral = {"domain": "behavioral", "topic_tags": ["leadership", "influence"]}

    assert question_matches_track(q_backend, "python_sql_github_cloud")
    assert question_matches_track(q_behavioral, "leadership_influence")


def test_question_matches_track_prefers_explicit_admin_track_marker():
    q_custom = {
        "_admin_track_id": "python_advanced_custom",
        "domain": "custom_admin",
        "topic_tags": ["admin_custom", "track:python_advanced_custom"],
    }

    assert question_matches_track(q_custom, "python_advanced_custom")
    assert not question_matches_track(q_custom, "python_sql_github_cloud")
