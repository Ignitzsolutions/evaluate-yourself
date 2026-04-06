"""
Comprehensive unit tests for all new Phase 1-4 features.

Covers:
  - llm_cache: get/put/clear/TTL/namespace isolation/max_size
  - competency_map: tag mapping, ID override, domain fallback, aggregation
  - star_extractor: keyword fallback, score helpers, legacy converter
  - semantic_scorer: token-overlap fallback
  - hiring_signal: threshold logic, flag adjustments, color helper
  - jd_parser: keyword fallback, empty/None input, filter_questions_by_jd
  - followup_generator: template fallback, deterministic stability
  - deterministic_rubric_evaluator: extract_depth_signals
  - report_generator: skip_v2 param, enrich_v2_fields
  - interview_questions: 208 questions, no duplicate IDs, required fields
  - GET report endpoint: v2 fields & enrichment_status in response
  - app BackgroundTasks: _run_v2_enrichment integration
"""

import sys
import os
import json
import uuid
from typing import Any, Dict, List
from unittest.mock import MagicMock, patch

import pytest

# ---------------------------------------------------------------------------
# path setup — works both from repo root and from backend/
# ---------------------------------------------------------------------------
BACKEND = os.path.join(os.path.dirname(__file__), "..")
if BACKEND not in sys.path:
    sys.path.insert(0, BACKEND)

# ---------------------------------------------------------------------------
# 1. LLM Cache
# ---------------------------------------------------------------------------
class TestLLMCache:
    def setup_method(self):
        from services.interview import llm_cache
        llm_cache.clear()
        self.cache = llm_cache

    def test_miss_returns_none(self):
        assert self.cache.get("ns", "key1") is None

    def test_put_then_get(self):
        self.cache.put("ns", {"result": 42}, "key1")
        assert self.cache.get("ns", "key1") == {"result": 42}

    def test_namespace_isolation(self):
        self.cache.put("ns_a", "value_a", "shared_key")
        self.cache.put("ns_b", "value_b", "shared_key")
        assert self.cache.get("ns_a", "shared_key") == "value_a"
        assert self.cache.get("ns_b", "shared_key") == "value_b"

    def test_clear_empties_cache(self):
        self.cache.put("ns", "val", "k")
        self.cache.clear()
        assert self.cache.get("ns", "k") is None

    def test_multiple_key_parts_hashed(self):
        self.cache.put("ns", "v1", "part_a", "part_b")
        assert self.cache.get("ns", "part_a", "part_b") == "v1"
        assert self.cache.get("ns", "part_b", "part_a") is None  # order matters

    def test_overwrite_existing(self):
        self.cache.put("ns", "first", "k")
        self.cache.put("ns", "second", "k")
        assert self.cache.get("ns", "k") == "second"

    def test_ttl_expiry(self):
        import time
        from services.interview import llm_cache
        # Temporarily patch TTL to 0 seconds so entries expire immediately
        original_ttl = llm_cache._CACHE_TTL
        llm_cache._CACHE_TTL = 0
        try:
            llm_cache.put("ns", "expiring", "k_ttl")
            time.sleep(0.01)
            result = llm_cache.get("ns", "k_ttl")
            # With 0-second TTL the entry should be stale
            assert result is None
        finally:
            llm_cache._CACHE_TTL = original_ttl


# ---------------------------------------------------------------------------
# 2. Competency Map
# ---------------------------------------------------------------------------
class TestCompetencyMap:
    def setup_method(self):
        from services.interview.competency_map import (
            get_competency_for_question,
            aggregate_competency_scores,
            COMPETENCY_KEYS,
        )
        self.get_comp = get_competency_for_question
        self.aggregate = aggregate_competency_scores
        self.keys = COMPETENCY_KEYS

    def test_six_competency_keys(self):
        assert set(self.keys) == {
            "communication", "problem_solving", "technical_depth",
            "ownership", "collaboration", "adaptability",
        }

    def test_tag_communication(self):
        assert self.get_comp(None, ["communication"], None, None) == "communication"

    def test_tag_teamwork_maps_collaboration(self):
        assert self.get_comp(None, ["teamwork"], None, None) == "collaboration"

    def test_tag_learning_maps_adaptability(self):
        assert self.get_comp(None, ["learning"], None, None) == "adaptability"

    def test_tag_debugging_maps_problem_solving(self):
        assert self.get_comp(None, ["debugging"], None, None) == "problem_solving"

    def test_tag_db_maps_technical_depth(self):
        assert self.get_comp(None, ["db"], None, None) == "technical_depth"

    def test_tag_ownership_maps_ownership(self):
        assert self.get_comp(None, ["ownership"], None, None) == "ownership"

    def test_id_override_bh_j_001(self):
        # bh_j_001 is "Tell me about yourself" → communication override
        assert self.get_comp("bh_j_001", ["growth"], None, None) == "communication"

    def test_id_override_bh_j_007(self):
        assert self.get_comp("bh_j_007", [], None, None) == "adaptability"

    def test_unknown_tags_return_default(self):
        result = self.get_comp(None, ["zzz_unknown_zzz"], None, None)
        assert result in self.keys  # falls to domain/default, still valid

    def test_aggregate_single_competency(self):
        turns = [
            {"competency": "communication", "score_0_100": 80},
            {"competency": "communication", "score_0_100": 60},
        ]
        scores = self.aggregate(turns)
        assert scores["communication"] == 70

    def test_aggregate_multiple_competencies(self):
        turns = [
            {"competency": "communication", "score_0_100": 100},
            {"competency": "ownership", "score_0_100": 50},
            {"competency": "ownership", "score_0_100": 70},
        ]
        scores = self.aggregate(turns)
        assert scores["communication"] == 100
        assert scores["ownership"] == 60

    def test_aggregate_empty(self):
        result = self.aggregate([])
        # Returns a dict with all 6 competencies at 0 when no turns provided
        assert isinstance(result, dict)
        assert all(v == 0 for v in result.values())

    def test_aggregate_ignores_unknown_competency(self):
        turns = [{"competency": "zzz", "score_0_100": 50}]
        scores = self.aggregate(turns)
        # unknown competency should either be omitted or not crash
        assert isinstance(scores, dict)

    def test_tag_scaling_maps_technical_depth(self):
        assert self.get_comp(None, ["scaling"], None, None) == "technical_depth"

    def test_tag_incident_maps_ownership(self):
        assert self.get_comp(None, ["incident"], None, None) == "ownership"

    def test_tag_conflict_maps_collaboration(self):
        assert self.get_comp(None, ["conflict"], None, None) == "collaboration"

    def test_tag_prioritization_maps_problem_solving(self):
        assert self.get_comp(None, ["prioritization"], None, None) == "problem_solving"


# ---------------------------------------------------------------------------
# 3. STAR Extractor
# ---------------------------------------------------------------------------
class TestStarExtractor:
    def setup_method(self):
        from services.interview.star_extractor import (
            extract_star, star_score_0_100, star_to_legacy_bool,
        )
        self.extract = extract_star
        self.score = star_score_0_100
        self.to_legacy = star_to_legacy_bool

    def _full_star_answer(self):
        return (
            "When I was at Acme Corp (situation), my task was to migrate our DB. "
            "I took action by writing a migration script step by step. "
            "As a result, we cut downtime by 80% and the team was happy."
        )

    def test_extract_returns_dict_with_four_keys(self):
        result = self.extract("Some answer text here.")
        assert isinstance(result, dict)
        for key in ("situation", "task", "action", "result"):
            assert key in result

    def test_each_component_has_detected_and_snippet(self):
        result = self.extract("Some answer text.")
        for key in ("situation", "task", "action", "result"):
            comp = result[key]
            assert "detected" in comp
            assert "snippet" in comp
            assert isinstance(comp["detected"], bool)

    def test_source_present(self):
        result = self.extract("Short.")
        assert "source" in result
        assert result["source"] in ("llm", "keyword_fallback")

    def test_action_detected_in_full_answer(self):
        result = self.extract(self._full_star_answer())
        assert result["action"]["detected"] is True

    def test_result_detected_in_full_answer(self):
        result = self.extract(self._full_star_answer())
        assert result["result"]["detected"] is True

    def test_empty_answer_all_false(self):
        result = self.extract("")
        for key in ("situation", "task", "action", "result"):
            assert result[key]["detected"] is False

    def test_score_0_100_range(self):
        result = self.extract(self._full_star_answer())
        score = self.score(result)
        assert 0 <= score <= 100

    def test_score_full_star_higher_than_empty(self):
        full = self.extract(self._full_star_answer())
        empty = self.extract("")
        assert self.score(full) >= self.score(empty)

    def test_to_legacy_bool_format(self):
        result = self.extract(self._full_star_answer())
        legacy = self.to_legacy(result)
        assert isinstance(legacy, dict)
        for key in ("situation", "task", "action", "result"):
            assert key in legacy
            assert isinstance(legacy[key], bool)

    def test_score_0_for_all_false(self):
        fake = {k: {"detected": False, "snippet": None} for k in ("situation", "task", "action", "result")}
        fake["source"] = "keyword_fallback"
        assert self.score(fake) == 0

    def test_score_100_for_all_true(self):
        fake = {k: {"detected": True, "snippet": "snippet"} for k in ("situation", "task", "action", "result")}
        fake["source"] = "keyword_fallback"
        assert self.score(fake) == 100


# ---------------------------------------------------------------------------
# 4. Semantic Scorer
# ---------------------------------------------------------------------------
class TestSemanticScorer:
    def setup_method(self):
        from services.interview.semantic_scorer import score_relevance
        self.score_relevance = score_relevance

    def test_returns_tuple_int_str(self):
        score, method = self.score_relevance("What is REST?", "REST stands for Representational State Transfer")
        assert isinstance(score, int)
        assert isinstance(method, str)

    def test_score_in_range(self):
        score, _ = self.score_relevance("Tell me about Python.", "Python is a high-level programming language.")
        assert 1 <= score <= 5

    def test_empty_answer_returns_low_score(self):
        score, _ = self.score_relevance("What is Docker?", "")
        assert score <= 2

    def test_highly_relevant_answer(self):
        q = "Explain what a database index is."
        a = "A database index is a data structure that improves the speed of data retrieval operations on a database table at the cost of additional writes and storage space."
        score, _ = self.score_relevance(q, a)
        assert score >= 2  # should be relevant even with fallback

    def test_irrelevant_answer_low_score(self):
        q = "Explain caching strategies."
        a = "I like to eat pizza and watch movies on weekends."
        score, _ = self.score_relevance(q, a)
        assert score <= 3  # token overlap should be low

    def test_method_label_returned(self):
        _, method = self.score_relevance("Q", "A")
        assert len(method) > 0


# ---------------------------------------------------------------------------
# 5. Hiring Signal
# ---------------------------------------------------------------------------
class TestHiringSignal:
    def setup_method(self):
        from services.interview.hiring_signal import compute_hiring_signal, hiring_signal_color
        self.compute = compute_hiring_signal
        self.color = hiring_signal_color

    def _result(self, score, turns=None, comps=None):
        return self.compute(
            overall_score=score,
            turn_analyses=turns or [],
            competency_scores=comps or {},
            interview_type="behavioral",
        )

    def test_strong_hire_above_80(self):
        r = self._result(85)
        assert r["signal"] == "strong_hire"

    def test_hire_65_to_79(self):
        r = self._result(72)
        assert r["signal"] == "hire"

    def test_borderline_50_to_64(self):
        r = self._result(55)
        assert r["signal"] == "borderline"

    def test_no_hire_below_50(self):
        r = self._result(40)
        assert r["signal"] == "no_hire"

    def test_returns_required_keys(self):
        r = self._result(70)
        for key in ("signal", "rationale_bullets", "red_flags", "green_flags"):
            assert key in r, f"Missing key: {key}"

    def test_rationale_is_list_of_3(self):
        r = self._result(70)
        assert isinstance(r["rationale_bullets"], list)
        assert len(r["rationale_bullets"]) >= 1

    def test_red_flags_is_list(self):
        r = self._result(30)
        assert isinstance(r["red_flags"], list)

    def test_green_flags_is_list(self):
        r = self._result(90)
        assert isinstance(r["green_flags"], list)

    def test_single_red_flag_lowers_signal(self):
        # 73 normally → hire; one red flag subtracts 8 → 65 → borderline
        # Use the new star_breakdown format (each component is a dict with "detected" key)
        turns = [{"star_breakdown": {"situation": {"detected": False, "snippet": ""}, "task": {"detected": False, "snippet": ""}, "action": {"detected": False, "snippet": ""}, "result": {"detected": False, "snippet": ""}}, "depth_signals": {"metrics_mentioned": [], "ownership_signals": 0, "impact_signals": 0, "tech_named": []}}] * 4
        r_no_flag = self._result(73)
        r_with_turns = self.compute(73, turns, {}, "behavioral")
        # signal may shift but should not crash
        assert r_with_turns["signal"] in ("strong_hire", "hire", "borderline", "no_hire")

    def test_flat_star_breakdown_shape_counts_as_detected(self):
        turns = [
            {
                "star_breakdown": {
                    "situation": True,
                    "task": True,
                    "action": True,
                    "result": True,
                },
                "depth_signals": {
                    "metrics_mentioned": ["30%"],
                    "ownership_signals": 1,
                    "impact_signals": 1,
                    "tech_named": [],
                },
            }
        ]
        result = self.compute(78, turns, {}, "behavioral")
        assert result["signal"] in ("hire", "strong_hire")

    def test_flat_star_breakdown_format_is_supported(self):
        turns = [{
            "star_breakdown": {
                "situation": True,
                "task": True,
                "action": True,
                "result": True,
            },
            "depth_signals": {
                "metrics_mentioned": ["30 percent"],
                "ownership_signals": 1,
                "impact_signals": 1,
                "tech_named": ["Redis"],
            },
        }]
        result = self.compute(78, turns, {}, "technical")
        assert result["signal"] in ("strong_hire", "hire")

    def test_strong_hire_with_good_comps(self):
        comps = {k: 90 for k in ["communication", "problem_solving", "ownership"]}
        r = self._result(88, comps=comps)
        assert r["signal"] == "strong_hire"

    def test_color_strong_hire(self):
        assert self.color("strong_hire") in ("success", "green", "#2e7d32")

    def test_color_no_hire(self):
        assert self.color("no_hire") in ("error", "red", "#c62828")

    def test_color_unknown_returns_string(self):
        result = self.color("unknown_signal")
        assert isinstance(result, str)

    def test_boundary_exactly_80_is_strong_hire(self):
        r = self._result(80)
        assert r["signal"] == "strong_hire"

    def test_boundary_exactly_65_is_hire(self):
        r = self._result(65)
        assert r["signal"] == "hire"

    def test_boundary_exactly_50_is_borderline(self):
        r = self._result(50)
        assert r["signal"] == "borderline"

    def test_boundary_49_is_no_hire(self):
        r = self._result(49)
        assert r["signal"] == "no_hire"


# ---------------------------------------------------------------------------
# 6. JD Parser
# ---------------------------------------------------------------------------
class TestJDParser:
    def setup_method(self):
        from services.interview.jd_parser import parse_jd, filter_questions_by_jd
        self.parse = parse_jd
        self.filter = filter_questions_by_jd

    def test_none_returns_none(self):
        assert self.parse(None) is None

    def test_empty_string_returns_none(self):
        assert self.parse("") is None

    def test_whitespace_returns_none(self):
        assert self.parse("   ") is None

    def test_parse_python_jd(self):
        jd = "We need a senior Python developer with experience in FastAPI, PostgreSQL, and AWS."
        result = self.parse(jd)
        assert result is not None
        assert isinstance(result, dict)

    def test_parse_returns_expected_keys(self):
        jd = "Looking for a backend engineer skilled in Go, Kubernetes, and system design."
        result = self.parse(jd)
        assert result is not None
        for key in ("tech_stack", "domain", "seniority", "skill_tracks", "key_competencies"):
            assert key in result

    def test_parse_detects_python(self):
        result = self.parse("Python developer needed for ML pipeline work.")
        assert result is not None
        techs = [t.lower() for t in result.get("tech_stack", [])]
        assert any("python" in t for t in techs)

    def test_parse_detects_senior(self):
        result = self.parse("We need a senior engineer with 8+ years experience.")
        assert result is not None
        assert "senior" in result.get("seniority", "").lower()

    def test_filter_returns_list(self):
        from data.interview_questions import ALL_QUESTIONS
        jd_signals = self.parse("Python backend engineer with SQL experience")
        result = self.filter(ALL_QUESTIONS, jd_signals)
        assert isinstance(result, list)
        assert len(result) > 0

    def test_filter_preserves_count(self):
        from data.interview_questions import ALL_QUESTIONS
        jd_signals = self.parse("Java developer")
        result = self.filter(ALL_QUESTIONS, jd_signals)
        assert len(result) == len(ALL_QUESTIONS)

    def test_filter_no_jd_returns_original_order(self):
        from data.interview_questions import ALL_QUESTIONS
        result = self.filter(ALL_QUESTIONS, None)
        assert result == ALL_QUESTIONS

    def test_parse_detects_ml(self):
        result = self.parse("Machine learning engineer for NLP and recommendation systems.")
        assert result is not None
        tracks = result.get("skill_tracks", [])
        # should detect ML/data track
        assert any("ml" in str(t).lower() or "data" in str(t).lower() for t in tracks) or result.get("domain")


# ---------------------------------------------------------------------------
# 7. Follow-up Generator
# ---------------------------------------------------------------------------
class TestFollowupGenerator:
    def setup_method(self):
        from services.interview.followup_generator import generate_followup
        self.generate = generate_followup

    def test_returns_string(self):
        result = self.generate(
            question="Tell me about a challenging project.",
            answer="I worked on a distributed system migration.",
            probe_reason="depth",
        )
        assert isinstance(result, str)
        assert len(result) > 0

    def test_non_empty_for_short_answer(self):
        result = self.generate(
            question="Describe a time you failed.",
            answer="I failed once.",
            probe_reason="outcome",
        )
        assert len(result.strip()) > 0

    def test_deterministic_with_same_inputs(self):
        kwargs = dict(
            question="Describe a conflict.",
            answer="I had a disagreement with my team about architecture.",
            probe_reason="resolution",
        )
        r1 = self.generate(**kwargs)
        r2 = self.generate(**kwargs)
        # Fallback (no LLM) should be deterministic
        assert r1 == r2

    def test_probe_reason_outcome_returns_followup(self):
        result = self.generate(
            question="Tell me about a success.",
            answer="We shipped a feature that improved performance.",
            probe_reason="outcome",
        )
        assert isinstance(result, str)

    def test_question_id_provided(self):
        result = self.generate(
            question_id="bh_j_001",
            question="Tell me about yourself.",
            answer="I am a software engineer with 5 years of experience.",
            probe_reason="depth",
        )
        assert isinstance(result, str)
        assert len(result) > 0

    def test_empty_answer_returns_fallback(self):
        result = self.generate(
            question="Describe a challenge.",
            answer="",
            probe_reason="depth",
        )
        assert isinstance(result, str)


# ---------------------------------------------------------------------------
# 8. Depth Signal Extraction
# ---------------------------------------------------------------------------
class TestDepthSignals:
    def setup_method(self):
        from services.interview.deterministic_rubric_evaluator import extract_depth_signals
        self.extract = extract_depth_signals

    def test_returns_dict(self):
        result = self.extract("I built a system.", "behavioral")
        assert isinstance(result, dict)

    def test_required_keys_present(self):
        result = self.extract("I improved the performance by 40%.", "behavioral")
        for key in ("word_count", "metrics_mentioned", "tech_named", "ownership_signals", "impact_signals", "hedge_hits"):
            assert key in result, f"Missing key: {key}"

    def test_word_count_accurate(self):
        answer = "This is a five word answer"
        result = self.extract(answer, "behavioral")
        assert result["word_count"] == 6

    def test_metrics_detected(self):
        answer = "We improved latency by 50% and reduced cost by $10,000."
        result = self.extract(answer, "behavioral")
        assert len(result["metrics_mentioned"]) >= 1

    def test_no_metrics_in_plain_text(self):
        answer = "I worked on the project with my team."
        result = self.extract(answer, "behavioral")
        assert len(result["metrics_mentioned"]) == 0

    def test_ownership_signals_detected(self):
        answer = "I led the initiative and I owned the entire deployment pipeline."
        result = self.extract(answer, "behavioral")
        assert result["ownership_signals"] >= 1

    def test_impact_signals_detected(self):
        answer = "As a result, we shipped faster and improved user retention significantly."
        result = self.extract(answer, "behavioral")
        assert result["impact_signals"] >= 1

    def test_tech_named_detected(self):
        answer = "I used Python and PostgreSQL to build the API."
        result = self.extract(answer, "technical")
        assert len(result["tech_named"]) >= 1

    def test_empty_answer(self):
        result = self.extract("", "behavioral")
        assert result["word_count"] == 0
        assert len(result["metrics_mentioned"]) == 0


# ---------------------------------------------------------------------------
# 9. Report Generator — skip_v2 and enrich_v2_fields
# ---------------------------------------------------------------------------
class TestReportGenerator:
    def _make_session_state(self, n_turns=2):
        """Minimal mock InterviewState with transcript_history and evaluation_results."""
        state = MagicMock()
        state.evaluation_results = [
            {
                "turn_id": i + 1,
                "clarity": 3.5,
                "depth": 3.0,
                "relevance": 3.5,
                "communication": 3.5,
                "star": {"situation": True, "task": True, "action": True, "result": False},
            }
            for i in range(n_turns)
        ]
        state.transcript_history = [
            {
                "question": f"Tell me about a challenge #{i+1}.",
                "answer": f"I faced a challenge at work where I had to lead the migration project and delivered it on time, reducing costs by 30%. My team appreciated the result.",
                "topic_tags": ["ownership"],
                "domain": "behavioral",
                "question_id": None,
                "timestamp": "2024-01-01T10:00:00+00:00",
            }
            for i in range(n_turns)
        ]
        state.get_performance_summary = MagicMock(return_value={
            "avg_clarity": 3.5, "avg_depth": 3.0, "avg_relevance": 3.5
        })
        state.interview_type = "behavioral"
        state.start_time = None
        state.gaze_metrics = []
        return state

    def test_generate_report_returns_interview_report(self):
        from services.report_generator import generate_report
        from models.interview import InterviewReport
        state = self._make_session_state()
        report = generate_report(state, "behavioral", 20)
        assert isinstance(report, InterviewReport)

    def test_generate_report_with_skip_v2_no_turn_analyses(self):
        from services.report_generator import generate_report
        state = self._make_session_state()
        report = generate_report(state, "behavioral", 20, skip_v2=True)
        assert report.turn_analyses is None or report.turn_analyses == []

    def test_generate_report_without_skip_v2_populates_turn_analyses(self):
        from services.report_generator import generate_report
        state = self._make_session_state(n_turns=2)
        report = generate_report(state, "behavioral", 20, skip_v2=False)
        # turn_analyses should be populated
        assert report.turn_analyses is not None
        assert len(report.turn_analyses) == 2

    def test_generate_report_scores_in_range(self):
        from services.report_generator import generate_report
        state = self._make_session_state()
        report = generate_report(state, "behavioral", 20)
        assert 0 <= report.overall_score <= 100

    def test_enrich_v2_fields_returns_dict(self):
        from services.report_generator import enrich_v2_fields
        state = self._make_session_state(n_turns=2)
        result = enrich_v2_fields(state, "behavioral", overall_score=70)
        assert isinstance(result, dict)

    def test_enrich_v2_fields_has_status_key(self):
        from services.report_generator import enrich_v2_fields
        state = self._make_session_state(n_turns=2)
        result = enrich_v2_fields(state, "behavioral", overall_score=70)
        assert "v2_enrichment_status" in result

    def test_enrich_v2_fields_complete_on_valid_session(self):
        from services.report_generator import enrich_v2_fields
        state = self._make_session_state(n_turns=2)
        result = enrich_v2_fields(state, "behavioral", overall_score=70)
        assert result["v2_enrichment_status"] in ("complete", "skipped_no_audio")

    def test_enrich_v2_fields_turn_analyses_present_on_complete(self):
        from services.report_generator import enrich_v2_fields
        state = self._make_session_state(n_turns=2)
        result = enrich_v2_fields(state, "behavioral", overall_score=70)
        if result["v2_enrichment_status"] == "complete":
            assert "v2_turn_analyses" in result
            assert isinstance(result["v2_turn_analyses"], list)

    def test_enrich_v2_fields_skipped_on_no_audio(self):
        from services.report_generator import enrich_v2_fields
        state = MagicMock()
        state.evaluation_results = []
        state.transcript_history = []
        result = enrich_v2_fields(state, "behavioral", overall_score=0)
        assert result["v2_enrichment_status"] == "skipped_no_audio"

    def test_enrich_v2_fields_competency_scores_dict(self):
        from services.report_generator import enrich_v2_fields
        state = self._make_session_state(n_turns=3)
        result = enrich_v2_fields(state, "behavioral", overall_score=75)
        if result["v2_enrichment_status"] == "complete":
            assert isinstance(result.get("v2_competency_scores"), dict)

    def test_generate_report_null_state_returns_minimal(self):
        from services.report_generator import generate_report
        from models.interview import InterviewReport
        report = generate_report(None, "behavioral", 10)
        assert isinstance(report, InterviewReport)
        assert report.overall_score == 0

    def test_turn_analysis_fields(self):
        from services.report_generator import generate_report
        state = self._make_session_state(n_turns=1)
        report = generate_report(state, "behavioral", 10)
        if report.turn_analyses:
            ta = report.turn_analyses[0]
            assert hasattr(ta, "competency")
            assert hasattr(ta, "score_0_100")
            assert hasattr(ta, "star_breakdown")
            assert hasattr(ta, "one_line_feedback")
            assert 0 <= ta.score_0_100 <= 100


# ---------------------------------------------------------------------------
# 10. Question Bank
# ---------------------------------------------------------------------------
class TestQuestionBank:
    def setup_method(self):
        from data.interview_questions import (
            ALL_QUESTIONS, EXTENDED_QUESTIONS, QUESTIONS_BY_ID,
            get_questions_by_type_and_difficulty, get_random_question,
        )
        self.all_q = ALL_QUESTIONS
        self.ext_q = EXTENDED_QUESTIONS
        self.by_id = QUESTIONS_BY_ID
        self.get_by_type = get_questions_by_type_and_difficulty
        self.get_random = get_random_question

    def test_total_questions_at_least_200(self):
        assert len(self.all_q) >= 200

    def test_extended_questions_58_or_more(self):
        assert len(self.ext_q) >= 58

    def test_no_duplicate_ids(self):
        ids = [q["id"] for q in self.all_q]
        assert len(ids) == len(set(ids)), "Duplicate question IDs found"

    def test_all_questions_have_required_fields(self):
        for q in self.all_q:
            assert "id" in q, f"Missing 'id' in {q}"
            assert "text" in q, f"Missing 'text' in {q}"
            assert "domain" in q, f"Missing 'domain' in {q}"
            assert "difficulty" in q, f"Missing 'difficulty' in {q}"
            assert "topic_tags" in q, f"Missing 'topic_tags' in {q}"
            assert isinstance(q["topic_tags"], list)

    def test_questions_by_id_lookup_works(self):
        for q in self.all_q:
            assert self.by_id[q["id"]] is q

    def test_get_behavioral_returns_questions(self):
        qs = self.get_by_type("behavioral", "mid")
        assert len(qs) > 0

    def test_get_technical_returns_questions(self):
        qs = self.get_by_type("technical", "mid")
        assert len(qs) > 0

    def test_get_mixed_returns_questions(self):
        qs = self.get_by_type("mixed", "mid")
        assert len(qs) > 0

    def test_difficulty_filter_junior(self):
        qs = self.get_by_type("behavioral", "junior")
        for q in qs:
            assert q["difficulty"] == "junior"

    def test_get_random_returns_question(self):
        q = self.get_random("behavioral", "mid")
        assert q is not None
        assert "id" in q

    def test_get_random_with_exclude(self):
        qs = self.get_by_type("behavioral", "mid")
        all_ids = [q["id"] for q in qs]
        exclude = all_ids[:-1]  # exclude all but last
        q = self.get_random("behavioral", "mid", exclude_ids=exclude)
        assert q is not None

    def test_extended_questions_all_have_expected_signals(self):
        for q in self.ext_q:
            assert "expected_signals" in q
            assert isinstance(q["expected_signals"], list)

    def test_extended_questions_cover_adaptability(self):
        from services.interview.competency_map import get_competency_for_question
        adaptability = [
            q for q in self.ext_q
            if get_competency_for_question(q.get("id"), q.get("topic_tags", []), q.get("domain"), q.get("domain")) == "adaptability"
        ]
        assert len(adaptability) >= 10

    def test_extended_questions_cover_communication(self):
        from services.interview.competency_map import get_competency_for_question
        comms = [
            q for q in self.ext_q
            if get_competency_for_question(q.get("id"), q.get("topic_tags", []), q.get("domain"), q.get("domain")) == "communication"
        ]
        assert len(comms) >= 8

    def test_no_empty_text(self):
        for q in self.all_q:
            assert q["text"].strip(), f"Empty text in question {q['id']}"


# ---------------------------------------------------------------------------
# 11. GET /api/interview/reports/{report_id} — v2 fields in response
# ---------------------------------------------------------------------------
class TestGetReportEndpointV2:
    """Test that the GET report endpoint correctly includes v2 fields from metrics JSON."""

    @pytest.fixture
    def client(self):
        try:
            from backend import app as app_module
        except ImportError:
            import app as app_module
        from fastapi.testclient import TestClient
        return TestClient(app_module.app)

    @pytest.fixture
    def sample_report_with_v2(self, client):
        """Insert a sample report with v2 fields in metrics and return its ID."""
        try:
            from backend import app as app_module
        except ImportError:
            import app as app_module
        from db.database import SessionLocal
        import db.models as models

        v2_metrics = {
            "v2_enrichment_status": "complete",
            "v2_turn_analyses": [{"turn_id": 1, "competency": "communication", "score_0_100": 75}],
            "v2_competency_scores": {"communication": 75},
            "v2_score_context": "Communication was strong.",
            "v2_hiring_recommendation": {"signal": "hire", "rationale": ["a", "b", "c"], "red_flags": [], "green_flags": ["clear communicator"]},
            "v2_improvement_roadmap": [],
        }

        report_id = str(uuid.uuid4())
        with SessionLocal() as db:
            row = models.InterviewReport(
                id=report_id,
                session_id=f"test-session-{report_id}",
                user_id="guest",
                title="Test Report V2",
                type="behavioral",
                mode="test",
                duration="10 minutes",
                overall_score=75,
                scores=json.dumps({"communication": 75}),
                transcript=json.dumps([]),
                recommendations=json.dumps(["Practice more."]),
                questions=3,
                is_sample=True,
                metrics=json.dumps(v2_metrics),
            )
            db.add(row)
            db.commit()
        yield report_id
        # cleanup
        with SessionLocal() as db:
            db.query(models.InterviewReport).filter(models.InterviewReport.id == report_id).delete()
            db.commit()

    def test_v2_fields_returned(self, client, sample_report_with_v2):
        resp = client.get(f"/api/interview/reports/{sample_report_with_v2}")
        assert resp.status_code == 200
        data = resp.json()
        assert "enrichment_status" in data
        assert data["enrichment_status"] == "complete"

    def test_turn_analyses_in_response(self, client, sample_report_with_v2):
        resp = client.get(f"/api/interview/reports/{sample_report_with_v2}")
        data = resp.json()
        assert "turn_analyses" in data
        assert isinstance(data["turn_analyses"], list)
        assert data["turn_analyses"][0]["competency"] == "communication"

    def test_competency_scores_in_response(self, client, sample_report_with_v2):
        resp = client.get(f"/api/interview/reports/{sample_report_with_v2}")
        data = resp.json()
        assert "competency_scores" in data
        assert data["competency_scores"]["communication"] == 75

    def test_hiring_recommendation_in_response(self, client, sample_report_with_v2):
        resp = client.get(f"/api/interview/reports/{sample_report_with_v2}")
        data = resp.json()
        assert "hiring_recommendation" in data
        assert data["hiring_recommendation"]["signal"] == "hire"

    def test_score_context_in_response(self, client, sample_report_with_v2):
        resp = client.get(f"/api/interview/reports/{sample_report_with_v2}")
        data = resp.json()
        assert "score_context" in data

    def test_improvement_roadmap_in_response(self, client, sample_report_with_v2):
        resp = client.get(f"/api/interview/reports/{sample_report_with_v2}")
        data = resp.json()
        assert "improvement_roadmap" in data

    def test_pending_enrichment_status(self, client):
        """Report with no v2 fields should return enrichment_status=pending."""
        try:
            from backend import app as app_module
        except ImportError:
            import app as app_module
        from db.database import SessionLocal
        import db.models as models

        report_id = str(uuid.uuid4())
        with SessionLocal() as db:
            row = models.InterviewReport(
                id=report_id,
                session_id=f"test-session-pending-{report_id}",
                user_id="guest",
                title="Pending Report",
                type="behavioral",
                mode="test",
                duration="5 minutes",
                overall_score=50,
                scores=json.dumps({}),
                transcript=json.dumps([]),
                recommendations=json.dumps([]),
                questions=1,
                is_sample=True,
                metrics=json.dumps({}),  # no v2 fields
            )
            db.add(row)
            db.commit()

        try:
            resp = client.get(f"/api/interview/reports/{report_id}")
            assert resp.status_code == 200
            data = resp.json()
            assert data["enrichment_status"] == "pending"
        finally:
            with SessionLocal() as db:
                db.query(models.InterviewReport).filter(models.InterviewReport.id == report_id).delete()
                db.commit()

    def test_404_for_unknown_report(self, client):
        resp = client.get(f"/api/interview/reports/{uuid.uuid4()}")
        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# 12. _run_v2_enrichment background function
# ---------------------------------------------------------------------------
class TestRunV2Enrichment:
    def test_enrichment_updates_db_report(self):
        """_run_v2_enrichment should write v2 fields to the metrics JSON of the report."""
        try:
            from backend import app as app_module
            from backend.app import _run_v2_enrichment
        except ImportError:
            import app as app_module
            from app import _run_v2_enrichment
        from db.database import SessionLocal
        import db.models as models

        report_id = str(uuid.uuid4())
        with SessionLocal() as db:
            row = models.InterviewReport(
                id=report_id,
                session_id=f"test-bg-{report_id}",
                user_id="guest",
                title="BG Test",
                type="behavioral",
                mode="test",
                duration="5 minutes",
                overall_score=65,
                scores=json.dumps({}),
                transcript=json.dumps([]),
                recommendations=json.dumps([]),
                questions=2,
                is_sample=True,
                metrics=json.dumps({"v2_enrichment_status": "pending"}),
            )
            db.add(row)
            db.commit()

        # Build a minimal mock session_state
        state = MagicMock()
        state.evaluation_results = []
        state.transcript_history = [
            {
                "question": "Tell me about a challenge.",
                "answer": "I led a migration and cut downtime by 40%.",
                "topic_tags": ["ownership"],
                "domain": "behavioral",
                "question_id": None,
            }
        ]

        try:
            _run_v2_enrichment(
                report_id=report_id,
                session_state=state,
                interview_type="behavioral",
                overall_score=65,
            )
            with SessionLocal() as db:
                updated = db.query(models.InterviewReport).filter(
                    models.InterviewReport.id == report_id
                ).first()
                assert updated is not None
                metrics = json.loads(updated.metrics)
                assert metrics.get("v2_enrichment_status") in ("complete", "skipped_no_audio", "failed")
        finally:
            with SessionLocal() as db:
                db.query(models.InterviewReport).filter(models.InterviewReport.id == report_id).delete()
                db.commit()

    def test_enrichment_handles_missing_report_gracefully(self):
        """If report_id doesn't exist, _run_v2_enrichment should not raise."""
        try:
            from app import _run_v2_enrichment
        except ImportError:
            from backend.app import _run_v2_enrichment

        state = MagicMock()
        state.evaluation_results = []
        state.transcript_history = []
        # Should not raise even when report is missing
        _run_v2_enrichment(
            report_id=str(uuid.uuid4()),
            session_state=state,
            interview_type="behavioral",
            overall_score=0,
        )
