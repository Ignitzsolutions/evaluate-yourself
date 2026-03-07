"""Interview state machine for managing interview sessions."""

from typing import Dict, List, Any
from datetime import datetime
from enum import Enum


class NextAction(Enum):
    PROBE_DEEPER = "probe_deeper"
    CLARIFY = "clarify"
    REDIRECT = "redirect"
    RAISE_BAR = "raise_bar"
    MOVE_ON = "move_on"


class InterviewState:
    """Manages interview session state and performance tracking."""
    
    def __init__(
        self,
        session_id: str,
        interview_type: str,
        difficulty: str,
        max_questions: int = 6
    ):
        self.session_id = session_id
        self.interview_type = interview_type  # behavioral, technical, mixed
        self.difficulty = difficulty  # junior, mid, senior
        self.max_questions = max_questions
        
        self.question_index = 0
        self.transcript_history: List[Dict[str, Any]] = []  # Q&A pairs
        self.evaluation_results: List[Dict[str, Any]] = []
        self.gaze_metrics: List[Dict[str, Any]] = []  # Gaze metrics per answer
        
        # Performance signals (running averages)
        self.performance_signals = {
            "pace": [],  # words per minute
            "clarity_scores": [],
            "depth_scores": [],
            "relevance_scores": [],
            "confidence_signals": [],  # low/med/high
            "pause_count": 0,
            "total_words": 0,
        }
        
        self.start_time = datetime.now()
        self.current_question = None
        self.current_answer = None
        self.is_active = True

    def to_dict(self) -> Dict[str, Any]:
        """Serialize state for storage."""
        return {
            "session_id": self.session_id,
            "interview_type": self.interview_type,
            "difficulty": self.difficulty,
            "max_questions": self.max_questions,
            "question_index": self.question_index,
            "transcript_history": self.transcript_history,
            "evaluation_results": self.evaluation_results,
            "gaze_metrics": self.gaze_metrics,
            "performance_signals": self.performance_signals,
            "start_time": self.start_time.isoformat() if self.start_time else None,
            "current_question": self.current_question,
            "current_answer": self.current_answer,
            "is_active": self.is_active,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "InterviewState":
        """Deserialize state from storage."""
        state = cls(
            session_id=data.get("session_id"),
            interview_type=data.get("interview_type", "mixed"),
            difficulty=data.get("difficulty", "mid"),
            max_questions=data.get("max_questions", 6),
        )
        state.question_index = data.get("question_index", 0)
        state.transcript_history = data.get("transcript_history", [])
        state.evaluation_results = data.get("evaluation_results", [])
        state.gaze_metrics = data.get("gaze_metrics", [])
        state.performance_signals = data.get("performance_signals", {
            "pace": [],
            "clarity_scores": [],
            "depth_scores": [],
            "relevance_scores": [],
            "confidence_signals": [],
            "pause_count": 0,
            "total_words": 0,
        })
        start_time = data.get("start_time")
        if start_time:
            try:
                state.start_time = datetime.fromisoformat(start_time)
            except Exception:
                state.start_time = datetime.now()
        state.current_question = data.get("current_question")
        state.current_answer = data.get("current_answer")
        state.is_active = data.get("is_active", True)
        return state
        
    def add_question(self, question_text: str):
        """Record a new question being asked."""
        self.current_question = question_text
        self.current_answer = None
        
    def add_answer(self, answer_text: str):
        """Record the user's answer to the current question."""
        self.current_answer = answer_text
        if self.current_question:
            self.transcript_history.append({
                "question": self.current_question,
                "answer": answer_text,
                "question_index": self.question_index,
                "timestamp": datetime.now().isoformat()
            })
    
    def add_evaluation(self, evaluation: Dict[str, Any]):
        """Add evaluation result for the current answer."""
        evaluation["question_index"] = self.question_index
        evaluation["question"] = self.current_question
        evaluation["answer"] = self.current_answer
        self.evaluation_results.append(evaluation)
        
        # Update performance signals
        if "clarity_score" in evaluation:
            self.performance_signals["clarity_scores"].append(evaluation["clarity_score"])
        if "depth_score" in evaluation:
            self.performance_signals["depth_scores"].append(evaluation["depth_score"])
        if "relevance_score" in evaluation:
            self.performance_signals["relevance_scores"].append(evaluation["relevance_score"])
        if "confidence_signal" in evaluation:
            self.performance_signals["confidence_signals"].append(evaluation["confidence_signal"])
        if "word_count" in evaluation:
            self.performance_signals["total_words"] += evaluation["word_count"]
        if "pause_count" in evaluation:
            self.performance_signals["pause_count"] += evaluation["pause_count"]
    
    def get_next_action(self, evaluation: Dict[str, Any]) -> NextAction:
        """Determine next action based on evaluation and performance trends."""
        clarity = evaluation.get("clarity_score", 3)
        depth = evaluation.get("depth_score", 3)
        relevance = evaluation.get("relevance_score", 3)
        
        # If answer is off-topic
        if relevance < 2:
            return NextAction.REDIRECT
        
        # If answer is unclear or misunderstood
        if clarity < 2:
            return NextAction.CLARIFY
        
        # If answer is shallow (especially for behavioral/technical)
        if depth < 2:
            return NextAction.PROBE_DEEPER
        
        # If answer is strong, raise the bar
        if clarity >= 4 and depth >= 4 and relevance >= 4:
            if self.question_index < self.max_questions - 1:
                return NextAction.RAISE_BAR
        
        # Default: move on to next question
        return NextAction.MOVE_ON
    
    def should_end(self) -> bool:
        """Check if interview should end."""
        return (
            not self.is_active or
            self.question_index >= self.max_questions
        )
    
    def move_to_next_question(self):
        """Increment question index."""
        self.question_index += 1
        self.current_question = None
        self.current_answer = None
    
    def get_performance_summary(self) -> Dict[str, Any]:
        """Get summary of performance signals."""
        clarity_scores = self.performance_signals["clarity_scores"]
        depth_scores = self.performance_signals["depth_scores"]
        relevance_scores = self.performance_signals["relevance_scores"]
        
        return {
            "avg_clarity": sum(clarity_scores) / len(clarity_scores) if clarity_scores else 0,
            "avg_depth": sum(depth_scores) / len(depth_scores) if depth_scores else 0,
            "avg_relevance": sum(relevance_scores) / len(relevance_scores) if relevance_scores else 0,
            "total_questions": self.question_index,
            "total_words": self.performance_signals["total_words"],
            "pause_count": self.performance_signals["pause_count"],
            "confidence_distribution": {
                "low": self.performance_signals["confidence_signals"].count("low"),
                "med": self.performance_signals["confidence_signals"].count("med"),
                "high": self.performance_signals["confidence_signals"].count("high"),
            }
        }
    
    def add_gaze_metrics(self, answer_index: int, metrics: Dict[str, Any]):
        """Store gaze metrics for a specific answer."""
        gaze_data = {
            "answer_index": answer_index,
            "eye_contact_pct": metrics.get("eyeContactPct", 0),
            "away_events": metrics.get("awayEvents", 0),
            "longest_away_duration": metrics.get("longestAwayDuration", 0),
            "timestamp": datetime.now().isoformat()
        }
        self.gaze_metrics.append(gaze_data)
    
    def end_interview(self):
        """Mark interview as ended."""
        self.is_active = False
