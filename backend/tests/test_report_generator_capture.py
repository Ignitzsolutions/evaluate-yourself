from datetime import datetime, timezone

try:
    from services.report_generator import generate_report
except Exception:
    from backend.services.report_generator import generate_report
try:
    from services.report_generator import _calculate_structure_score
except Exception:
    from backend.services.report_generator import _calculate_structure_score


class FakeSession:
    def __init__(self, transcript_history=None, evaluations=None):
        self.transcript_history = transcript_history or []
        self.evaluation_results = evaluations or []
        self.question_index = len(self.transcript_history)
        self.total_words = 0
        self.speaking_time = 60
        self.silence_time = 0
        self.eye_contact_pct = None

    def get_performance_summary(self):
        if not self.evaluation_results:
            return {"avg_clarity": 0, "avg_depth": 0, "avg_relevance": 0}
        return {"avg_clarity": 4, "avg_depth": 4, "avg_relevance": 4}


def test_report_marks_incomplete_when_no_candidate_turns():
    session = FakeSession(
        transcript_history=[
            {"question": "Tell me about yourself", "answer": "", "timestamp": datetime.now(timezone.utc).isoformat()}
        ],
        evaluations=[],
    )

    report = generate_report(session, "mixed", 1)

    assert report.overall_score == 0
    assert report.metrics["capture_status"] == "INCOMPLETE_NO_CANDIDATE_AUDIO"
    assert report.scores.communication == 0


def test_report_marks_complete_when_candidate_turns_exist():
    session = FakeSession(
        transcript_history=[
            {
                "question": "Tell me about yourself",
                "answer": "I worked on backend reliability and reduced latency.",
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
        ],
        evaluations=[{"clarity": 4, "depth": 4, "relevance": 4, "star_completeness": {}}],
    )

    report = generate_report(session, "mixed", 2)

    assert report.overall_score > 0
    assert report.metrics["capture_status"] == "COMPLETE"


def test_report_score_is_bounded_without_forcing_an_optimistic_floor():
    session = FakeSession(
        transcript_history=[
            {
                "question": "Tell me about a challenge",
                "answer": "I handled a production incident with a structured mitigation plan and postmortem.",
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
        ],
        evaluations=[{"clarity": 5, "depth": 5, "relevance": 5, "star_completeness": {}}],
    )
    report = generate_report(session, "mixed", 2)
    assert 0 <= report.overall_score <= 100


def test_structure_score_falls_back_to_clarity_key_when_clarity_score_missing():
    score = _calculate_structure_score(
        [
            {"clarity": 4, "depth": 3, "relevance": 4},
            {"clarity": 5, "depth": 4, "relevance": 5},
        ]
    )
    assert score >= 80
