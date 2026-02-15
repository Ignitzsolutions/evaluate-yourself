from datetime import datetime

try:
    from services.report_generator import generate_report
except Exception:
    from backend.services.report_generator import generate_report


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
            {"question": "Tell me about yourself", "answer": "", "timestamp": datetime.utcnow().isoformat()}
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
                "timestamp": datetime.utcnow().isoformat(),
            }
        ],
        evaluations=[{"clarity": 4, "depth": 4, "relevance": 4, "star_completeness": {}}],
    )

    report = generate_report(session, "mixed", 2)

    assert report.overall_score > 0
    assert report.metrics["capture_status"] == "COMPLETE"
