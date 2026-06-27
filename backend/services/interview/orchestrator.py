"""Interview orchestrator - coordinates the pipeline (scoring + feedback)."""

import json
import logging
import uuid
from typing import Optional, Dict, Any
import redis

from services.session.session_manager import SessionManager
from services.session.session_events import SessionEventLog
from services.interview.transcript_service import TranscriptService
from services.interview.scoring_service import ScoringService
from services.llm.chains.candidate_feedback import generate_candidate_feedback

logger = logging.getLogger(__name__)


class InterviewOrchestrator:
    """Orchestrates the interview evaluation pipeline."""

    def __init__(
        self,
        session_manager: SessionManager,
        event_log: SessionEventLog,
        transcript_service: TranscriptService,
        scoring_service: ScoringService,
        redis_client: redis.Redis
    ):
        """Initialize orchestrator with dependencies."""
        self.session_manager = session_manager
        self.event_log = event_log
        self.transcript_service = transcript_service
        self.scoring_service = scoring_service
        self.redis = redis_client
        self.idempotency_prefix = "idempotency:"

    def evaluate_interview(
        self,
        session_id: str,
        transcript_id: str,
        interview_type: str = "behavioral",
        duration_minutes: int = 0,
        idempotency_key: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Main entry point: evaluate interview with scoring + feedback.
        
        Returns:
            {scorecard_id, feedback_id, correlation_id} on success, None on failure
        """
        correlation_id = str(uuid.uuid4())
        logger.info(f"[{correlation_id}] Starting interview evaluation for session {session_id}")
        eval_cache_key = None
        lock_key = None
        lock_acquired = False
        
        try:
            if idempotency_key:
                eval_cache_key = f"{self.idempotency_prefix}{session_id}:evaluate:{idempotency_key}"
                lock_key = f"{self.idempotency_prefix}{session_id}:evaluate:lock:{idempotency_key}"
                cached_eval = self.redis.get(eval_cache_key)
                if cached_eval:
                    logger.info(f"[{correlation_id}] Evaluation cache hit for key {idempotency_key}")
                    return json.loads(cached_eval)
                lock_acquired = bool(self.redis.set(lock_key, correlation_id, nx=True, ex=120))
                if not lock_acquired:
                    logger.warning(f"[{correlation_id}] Duplicate evaluation request for key {idempotency_key}")
                    return None

            # 1. Validate session
            session = self.session_manager.get_session(session_id)
            if not session:
                self.event_log.append(session_id, "ERROR", {
                    "error_message": "Session not found",
                    "correlation_id": correlation_id
                })
                return None
            
            # 2. Load transcript
            transcript_text = self.transcript_service.get_transcript(transcript_id)
            if not transcript_text:
                self.event_log.append(session_id, "ERROR", {
                    "error_message": f"Transcript {transcript_id} not found",
                    "correlation_id": correlation_id,
                    "transcript_id": transcript_id
                })
                return None

            if not self.session_manager.update_state(session_id, "TRANSCRIPT_ATTACHED"):
                self.event_log.append(session_id, "ERROR", {
                    "error_message": "Invalid session transition to TRANSCRIPT_ATTACHED",
                    "correlation_id": correlation_id
                })
                return None
            
            # 3. Run scoring step
            scorecard_data = self._run_scoring_step(
                session_id, transcript_id, interview_type, duration_minutes, idempotency_key, correlation_id
            )
            if not scorecard_data:
                return None
            
            scorecard_id = scorecard_data.get("scorecard_id")
            
            # 4. Run feedback step
            feedback_data = self._run_feedback_step(
                session_id, transcript_text, scorecard_data, interview_type, duration_minutes, idempotency_key, correlation_id
            )
            if not feedback_data:
                return None
            
            feedback_id = feedback_data.get("feedback_id")
            
            # 5. Update session state
            if not self.session_manager.update_state(session_id, "FEEDBACK_GENERATED"):
                self.event_log.append(session_id, "ERROR", {
                    "error_message": "Invalid session transition to FEEDBACK_GENERATED",
                    "correlation_id": correlation_id
                })
                return None
            
            logger.info(f"[{correlation_id}] Interview evaluation complete: scorecard={scorecard_id}, feedback={feedback_id}")

            result = {
                "scorecard_id": scorecard_id,
                "feedback_id": feedback_id,
                "correlation_id": correlation_id
            }
            if eval_cache_key:
                self.redis.setex(eval_cache_key, 86400, json.dumps(result))
            return result
            
        except Exception as e:
            logger.error(f"[{correlation_id}] Error evaluating interview: {e}")
            self.event_log.append(session_id, "ERROR", {
                "error_message": str(e),
                "correlation_id": correlation_id
            })
            return None
        finally:
            if lock_key and lock_acquired:
                try:
                    self.redis.delete(lock_key)
                except Exception:  # noqa: BLE001
                    logger.warning(f"[{correlation_id}] Failed to release idempotency lock for {session_id}")

    def _run_scoring_step(
        self,
        session_id: str,
        transcript_id: str,
        interview_type: str,
        duration_minutes: int,
        idempotency_key: Optional[str],
        correlation_id: str
    ) -> Optional[Dict[str, Any]]:
        """Run scoring step with idempotency."""
        try:
            # Check idempotency cache
            if idempotency_key:
                cache_key = f"{self.idempotency_prefix}{session_id}:scoring:{idempotency_key}"
                cached = self.redis.get(cache_key)
                if cached:
                    logger.info(f"[{correlation_id}] Scoring cache hit for key {idempotency_key}")
                    import json
                    return json.loads(cached)
            
            # Emit SCORING_STARTED
            self.event_log.append(session_id, "SCORING_STARTED", {
                "correlation_id": correlation_id,
                "transcript_id": transcript_id
            })
            
            # Update session state
            if not self.session_manager.update_state(session_id, "SCORING_STARTED"):
                raise RuntimeError("Invalid session transition to SCORING_STARTED")
            
            # Score transcript
            transcript_text = self.transcript_service.get_transcript(transcript_id)
            if not transcript_text:
                return None

            transcript_turns = self._to_transcript_turns(transcript_text)
            scorecard = self.scoring_service.score_interview(
                session_id=session_id,
                candidate_id="candidate",
                transcript_turns=transcript_turns,
                interview_type=interview_type,
                duration_minutes=duration_minutes,
            )
            
            scorecard_id = scorecard.get("scorecard_id")
            
            # Emit SCORING_COMPLETED
            self.event_log.append(session_id, "SCORING_COMPLETED", {
                "correlation_id": correlation_id,
                "scorecard_id": scorecard_id
            })
            
            # Cache result (24 hours)
            if idempotency_key:
                import json
                cache_key = f"{self.idempotency_prefix}{session_id}:scoring:{idempotency_key}"
                self.redis.setex(cache_key, 86400, json.dumps(scorecard))
            
            return scorecard
            
        except Exception as e:
            logger.error(f"[{correlation_id}] Error in scoring step: {e}")
            self.event_log.append(session_id, "ERROR", {
                "error_message": f"Scoring failed: {e}",
                "correlation_id": correlation_id
            })
            return None

    def _run_feedback_step(
        self,
        session_id: str,
        transcript_text: str,
        scorecard_data: Dict[str, Any],
        interview_type: str,
        duration_minutes: int,
        idempotency_key: Optional[str],
        correlation_id: str
    ) -> Optional[Dict[str, Any]]:
        """Run feedback generation step with idempotency."""
        try:
            # Check idempotency cache
            if idempotency_key:
                cache_key = f"{self.idempotency_prefix}{session_id}:feedback:{idempotency_key}"
                cached = self.redis.get(cache_key)
                if cached:
                    logger.info(f"[{correlation_id}] Feedback cache hit for key {idempotency_key}")
                    import json
                    return json.loads(cached)
            
            # Emit FEEDBACK_STARTED
            self.event_log.append(session_id, "FEEDBACK_STARTED", {
                "correlation_id": correlation_id,
                "scorecard_id": scorecard_data.get("scorecard_id")
            })
            
            # Update session state
            if not self.session_manager.update_state(session_id, "FEEDBACK_STARTED"):
                raise RuntimeError("Invalid session transition to FEEDBACK_STARTED")
            
            # Build LLM context
            session = self.session_manager.get_session(session_id)
            if not session:
                return None
            
            llm_context = self.session_manager.build_llm_context(session)
            
            # Generate feedback
            score_summary = scorecard_data.get("scores", {})
            feedback = generate_candidate_feedback(
                transcript_text=transcript_text,
                llm_context=llm_context,
                score_summary=score_summary,
                interview_type=interview_type,
                duration_minutes=duration_minutes
            )
            
            if not feedback:
                return None
            
            # Create feedback record
            feedback_id = f"fb_{session_id[:8]}_{uuid.uuid4().hex[:8]}"
            feedback_data = {
                "feedback_id": feedback_id,
                "session_id": session_id,
                "scorecard_id": scorecard_data.get("scorecard_id"),
                "content": feedback,
                "created_at": str(__import__('datetime').datetime.utcnow())
            }
            
            # Emit FEEDBACK_GENERATED
            self.event_log.append(session_id, "FEEDBACK_GENERATED", {
                "correlation_id": correlation_id,
                "feedback_id": feedback_id
            })
            
            # Cache result (24 hours)
            if idempotency_key:
                import json
                cache_key = f"{self.idempotency_prefix}{session_id}:feedback:{idempotency_key}"
                self.redis.setex(cache_key, 86400, json.dumps(feedback_data))
            
            return feedback_data
            
        except Exception as e:
            logger.error(f"[{correlation_id}] Error in feedback step: {e}")
            self.event_log.append(session_id, "ERROR", {
                "error_message": f"Feedback failed: {e}",
                "correlation_id": correlation_id
            })
            return None

    @staticmethod
    def _to_transcript_turns(transcript_text: str) -> list[dict[str, Any]]:
        """Normalize transcript payload into scorer-compatible role/content turns."""
        if not transcript_text:
            return []
        try:
            payload = json.loads(transcript_text)
            if isinstance(payload, list):
                turns = payload
            elif isinstance(payload, dict):
                turns = payload.get("transcript") or payload.get("raw_messages") or payload.get("messages") or []
            else:
                turns = []
            normalized = []
            for turn in turns:
                if not isinstance(turn, dict):
                    continue
                role = (turn.get("role") or turn.get("speaker") or "candidate").lower()
                content = turn.get("content") or turn.get("text") or turn.get("answer") or ""
                normalized.append({"role": role, "content": str(content)})
            if normalized:
                return normalized
        except json.JSONDecodeError:
            pass
        return [{"role": "candidate", "content": str(transcript_text)}]
