from backend.scripts.schema_smoke import check_required_schema


class FakeInspector:
    def __init__(self, tables):
        self._tables = tables

    def has_table(self, table_name):
        return table_name in self._tables

    def get_columns(self, table_name):
        return [{"name": column_name} for column_name in self._tables[table_name]]


def test_check_required_schema_reports_missing_auth_column():
    inspector = FakeInspector(
        {
            "users": {"clerk_user_id", "email", "is_active", "is_deleted"},
            "auth_identities": {"provider", "provider_user_id", "user_id"},
            "user_emails": {"user_id", "normalized_email", "is_primary", "is_verified"},
            "user_phones": {"user_id", "phone_e164", "is_primary", "is_verified"},
            "trial_codes": {"display_name", "status", "code"},
            "launch_waitlist_signups": {"normalized_email", "source_page", "intent", "status"},
            "trial_feedback": {"report_id", "rating", "trial_mode", "submitted_at"},
            "interview_gaze_events": {"event_type", "source"},
            "interview_reports": {"metrics", "transcript"},
        }
    )

    error = check_required_schema(inspector)

    assert error == "❌ Missing columns in users: phone_e164"


def test_check_required_schema_passes_when_auth_tables_are_present():
    inspector = FakeInspector(
        {
            "users": {"clerk_user_id", "email", "phone_e164", "is_active", "is_deleted"},
            "auth_identities": {"provider", "provider_user_id", "user_id"},
            "user_emails": {"user_id", "normalized_email", "is_primary", "is_verified"},
            "user_phones": {"user_id", "phone_e164", "is_primary", "is_verified"},
            "trial_codes": {"display_name", "status", "code"},
            "launch_waitlist_signups": {"normalized_email", "source_page", "intent", "status"},
            "trial_feedback": {"report_id", "rating", "trial_mode", "submitted_at"},
            "interview_gaze_events": {"event_type", "source"},
            "interview_reports": {"metrics", "transcript"},
        }
    )

    assert check_required_schema(inspector) is None
