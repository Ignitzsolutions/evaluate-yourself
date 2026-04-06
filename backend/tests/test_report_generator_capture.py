from datetime import datetime, timezone

try:
    from services.report_generator import generate_report, overall_score_formula_text
except Exception:
    from backend.services.report_generator import generate_report, overall_score_formula_text
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


def test_report_score_is_bounded_with_floor_and_ceiling():
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
    assert 20 <= report.overall_score <= 100


def test_structure_score_falls_back_to_clarity_key_when_clarity_score_missing():
    score = _calculate_structure_score(
        [
            {"clarity": 4, "depth": 3, "relevance": 4},
            {"clarity": 5, "depth": 4, "relevance": 5},
        ]
    )
    assert score >= 80


def test_report_exposes_weighted_formula_and_score_ledger():
    session = FakeSession(
        transcript_history=[
            {
                "question": "Walk me through a recent technical decision you owned.",
                "answer": "I redesigned our retry flow, reduced duplicate processing by 30 percent, and added idempotency keys to stabilize recovery.",
                "timestamp": datetime.now(timezone.utc).isoformat(),
            },
            {
                "question": "What happened next?",
                "answer": "brief reply",
                "timestamp": datetime.now(timezone.utc).isoformat(),
            },
        ],
        evaluations=[
            {
                "turn_id": 1,
                "clarity": 4,
                "communication": 4,
                "depth": 5,
                "relevance": 4,
                "confidence": "high",
                "evidence_excerpt": "reduced duplicate processing by 30 percent",
            }
        ],
    )

    report = generate_report(session, "technical", 5)

    assert report.metrics["evaluation_explainability"]["formula"] == overall_score_formula_text()
    assert report.metrics["evaluation_explainability"]["weights"]["communication"] == 0.20
    assert len(report.metrics["score_ledger"]) == 2
    assert report.metrics["score_ledger"][0]["included_in_score"] is True
    assert report.metrics["score_ledger"][1]["included_in_score"] is False
    assert report.metrics["score_ledger"][0]["transcript_ref_label"].startswith("Turn 1")
    assert report.metrics["score_ledger"][1]["exclusion_detail"]


def test_report_dampens_weak_but_wordy_answers():
    weak_session = FakeSession(
        transcript_history=[
            {
                "question": "Tell me about a project you are proud of.",
                "answer": (
                    "I worked on a lot of things with the team and handled many tasks across different projects. "
                    "It was challenging but I managed, learned a lot, and helped deliver what was needed."
                ),
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
        ],
        evaluations=[
            {
                "turn_id": 1,
                "clarity": 4,
                "communication": 4,
                "depth": 3,
                "relevance": 4,
                "evidence_quality": 2,
                "answer_completeness": 2,
                "weak_signal_flags": ["generic_low_evidence", "long_but_unspecific"],
                "star_completeness": {"situation": True, "task": False, "action": False, "result": False},
            }
        ],
    )
    strong_session = FakeSession(
        transcript_history=[
            {
                "question": "Tell me about a project you are proud of.",
                "answer": (
                    "I led a retry redesign for our payments service after duplicate charges increased during failures. "
                    "I added idempotency keys, retried only safe operations, and rolled out the change gradually. "
                    "That reduced duplicate charges by 40% and cut support tickets significantly."
                ),
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
        ],
        evaluations=[
            {
                "turn_id": 1,
                "clarity": 4,
                "communication": 4,
                "depth": 5,
                "relevance": 4,
                "evidence_quality": 5,
                "answer_completeness": 5,
                "weak_signal_flags": [],
                "star_completeness": {"situation": True, "task": True, "action": True, "result": True},
            }
        ],
    )

    weak_report = generate_report(weak_session, "mixed", 3)
    strong_report = generate_report(strong_session, "mixed", 3)

    assert weak_report.overall_score < strong_report.overall_score
    assert weak_report.metrics["evaluation_explainability"]["quality_multiplier"] < 1
    assert weak_report.metrics["evaluation_explainability"]["credible_signal_present"] is False
    assert strong_report.metrics["evaluation_explainability"]["credible_signal_present"] is True
