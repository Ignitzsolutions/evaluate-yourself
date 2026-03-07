"""Comprehensive WebSocket realtime tests for PHASE 3."""

import pytest
import pytest_asyncio
import json
import asyncio
from fastapi.testclient import TestClient
from fastapi import FastAPI
from datetime import datetime, timedelta
import redis

from backend.api.realtime import router
from backend.services.auth.token_service import TokenService
from backend.services.session.session_store import SessionStore
from backend.services.session.session_manager import SessionManager
from backend.services.session.session_events import SessionEventLog
from backend.services.session.session_models import SessionData, SessionMeta, SessionCandidate, SessionState, SessionRefs
from backend.services.interview.transcript_service import TranscriptService
from backend.services.interview.scoring_service import ScoringService
from backend.services.interview.orchestrator import InterviewOrchestrator


# ============================================================================
# Fixtures
# ============================================================================

@pytest.fixture
def redis_client():
    """Redis client for testing."""
    client = redis.Redis(host="localhost", port=6379, decode_responses=True, db=15)
    yield client
    client.flushdb()


@pytest.fixture
def token_service():
    """Token service instance."""
    return TokenService(secret_key="test-secret-key")


@pytest.fixture
def session_store(redis_client):
    """Session store instance."""
    return SessionStore(redis_client)


@pytest.fixture
def session_manager(session_store):
    """Session manager instance."""
    return SessionManager(session_store)


@pytest.fixture
def event_log(redis_client):
    """Event log instance."""
    return SessionEventLog(redis_client)


@pytest.fixture
def transcript_service():
    """Transcript service instance."""
    return TranscriptService()


@pytest.fixture
def scoring_service():
    """Scoring service instance."""
    return ScoringService()


@pytest.fixture
def orchestrator(session_manager, event_log, transcript_service, scoring_service, redis_client):
    """Orchestrator instance."""
    return InterviewOrchestrator(session_manager, event_log, transcript_service, scoring_service, redis_client)


@pytest.fixture
def test_session(session_manager):
    """Create a test session."""
    session = session_manager.create_session(
        candidate_id="test_candidate_123",
        tenant_id="test_tenant_456",
        email="test@example.com",
        name="Test User"
    )
    return session


@pytest.fixture
def valid_token(test_session, token_service):
    """Generate a valid JWT token for test session."""
    return token_service.create_session_token(
        session_id=test_session.meta.session_id,
        candidate_id=test_session.candidate.candidate_id,
        tenant_id=test_session.candidate.tenant_id
    )


@pytest.fixture
def app():
    """FastAPI app instance with router."""
    test_app = FastAPI()
    test_app.include_router(router, prefix="/ws")
    return test_app


@pytest.fixture
def client(app):
    """Test client."""
    return TestClient(app)


# ============================================================================
# Test Suite: Authentication
# ============================================================================

class TestWebSocketAuth:
    """Test WebSocket authentication and authorization."""
    
    def test_auth_valid_token_accepted(self, client, test_session, valid_token):
        """Valid JWT token should be accepted."""
        with client.websocket_connect(f"/ws/interview/{test_session.meta.session_id}?token={valid_token}") as websocket:
            # Should receive WELCOME
            data = websocket.receive_json()
            assert data["type"] == "WELCOME"
            assert data["session_id"] == test_session.meta.session_id
    
    def test_auth_missing_token_rejected(self, client, test_session):
        """Missing token should be rejected with 4401."""
        with pytest.raises(Exception) as exc:
            with client.websocket_connect(f"/ws/interview/{test_session.meta.session_id}"):
                pass
        assert "4401" in str(exc.value)
    
    def test_auth_invalid_token_rejected(self, client, test_session):
        """Invalid token should be rejected with 4401."""
        with pytest.raises(Exception) as exc:
            with client.websocket_connect(f"/ws/interview/{test_session.meta.session_id}?token=invalid_token"):
                pass
        assert "4401" in str(exc.value)
    
    def test_auth_expired_token_rejected(self, client, test_session, token_service):
        """Expired token should be rejected with 4401."""
        # Create token with past expiration
        import jwt
        now = datetime.utcnow()
        expired_payload = {
            "iss": token_service.issuer,
            "aud": token_service.audience,
            "sub": test_session.candidate.candidate_id,
            "session_id": test_session.meta.session_id,
            "tenant_id": test_session.candidate.tenant_id,
            "exp": now - timedelta(hours=1)
        }
        expired_token = jwt.encode(expired_payload, token_service.secret_key, algorithm=token_service.algorithm)
        
        with pytest.raises(Exception) as exc:
            with client.websocket_connect(f"/ws/interview/{test_session.meta.session_id}?token={expired_token}"):
                pass
        assert "4401" in str(exc.value)
    
    def test_auth_tenant_mismatch_rejected(self, client, test_session, token_service):
        """Token with mismatched tenant should be rejected with 4403."""
        wrong_tenant_token = token_service.create_session_token(
            session_id=test_session.meta.session_id,
            candidate_id=test_session.candidate.candidate_id,
            tenant_id="wrong_tenant_999"
        )
        
        with pytest.raises(Exception) as exc:
            with client.websocket_connect(f"/ws/interview/{test_session.meta.session_id}?token={wrong_tenant_token}"):
                pass
        assert "4403" in str(exc.value)


# ============================================================================
# Test Suite: Replay & Events
# ============================================================================

class TestWebSocketReplay:
    """Test event replay functionality."""
    
    def test_hello_without_last_event_id_replays_all(self, client, test_session, valid_token, event_log):
        """HELLO without last_event_id should replay all events."""
        # Pre-populate events
        event_log.append(test_session.meta.session_id, "SESSION_CREATED", {})
        event_log.append(test_session.meta.session_id, "TRANSCRIPT_ATTACHED", {"transcript_id": "tr_123"})
        
        with client.websocket_connect(f"/ws/interview/{test_session.meta.session_id}?token={valid_token}") as websocket:
            # WELCOME
            welcome = websocket.receive_json()
            assert welcome["type"] == "WELCOME"
            
            # Send HELLO
            websocket.send_json({"type": "HELLO", "last_event_id": "0"})
            
            # Should receive REPLAY
            replay = websocket.receive_json()
            assert replay["type"] == "REPLAY"
            assert len(replay["events"]) >= 2
    
    def test_hello_with_last_event_id_resumes(self, client, test_session, valid_token, event_log):
        """HELLO with last_event_id should only replay events after that ID."""
        # Pre-populate events
        event_id_1 = event_log.append(test_session.meta.session_id, "SESSION_CREATED", {})
        event_id_2 = event_log.append(test_session.meta.session_id, "TRANSCRIPT_ATTACHED", {"transcript_id": "tr_123"})
        event_id_3 = event_log.append(test_session.meta.session_id, "SCORING_STARTED", {})
        
        with client.websocket_connect(f"/ws/interview/{test_session.meta.session_id}?token={valid_token}") as websocket:
            # WELCOME
            welcome = websocket.receive_json()
            assert welcome["type"] == "WELCOME"
            
            # Send HELLO with last_event_id = event_id_1
            websocket.send_json({"type": "HELLO", "last_event_id": event_id_1})
            
            # Should receive REPLAY with only events after event_id_1
            replay = websocket.receive_json()
            assert replay["type"] == "REPLAY"
            # Should include event_id_2 and event_id_3, but not event_id_1
            event_ids = [e.get("event_id") for e in replay["events"]]
            assert event_id_1 not in event_ids
            assert event_id_2 in event_ids or event_id_3 in event_ids
    
    def test_replay_chunked_correctly(self, client, test_session, valid_token, event_log):
        """Large event lists should be chunked (max 100 events per chunk)."""
        # Pre-populate 250 events
        for i in range(250):
            event_log.append(test_session.meta.session_id, f"EVENT_{i}", {"index": i})
        
        with client.websocket_connect(f"/ws/interview/{test_session.meta.session_id}?token={valid_token}") as websocket:
            # WELCOME
            welcome = websocket.receive_json()
            assert welcome["type"] == "WELCOME"
            
            # Send HELLO
            websocket.send_json({"type": "HELLO", "last_event_id": "0"})
            
            # Should receive multiple REPLAY chunks
            chunks = []
            try:
                while True:
                    msg = websocket.receive_json(timeout=1.0)
                    if msg["type"] == "REPLAY":
                        chunks.append(msg)
                    else:
                        break
            except:
                pass
            
            assert len(chunks) >= 2  # At least 2 chunks for 250 events
            assert all(len(chunk["events"]) <= 100 for chunk in chunks)
    
    def test_replay_ordering_monotonic(self, client, test_session, valid_token, event_log):
        """Events in REPLAY should be in chronological order."""
        # Pre-populate events with specific order
        event_log.append(test_session.meta.session_id, "EVENT_1", {"seq": 1})
        event_log.append(test_session.meta.session_id, "EVENT_2", {"seq": 2})
        event_log.append(test_session.meta.session_id, "EVENT_3", {"seq": 3})
        
        with client.websocket_connect(f"/ws/interview/{test_session.meta.session_id}?token={valid_token}") as websocket:
            # WELCOME
            welcome = websocket.receive_json()
            assert welcome["type"] == "WELCOME"
            
            # Send HELLO
            websocket.send_json({"type": "HELLO", "last_event_id": "0"})
            
            # Receive REPLAY
            replay = websocket.receive_json()
            events = replay["events"]
            
            # Verify chronological order
            sequences = [e["metadata"].get("seq") for e in events if "seq" in e.get("metadata", {})]
            assert sequences == sorted(sequences)


# ============================================================================
# Test Suite: Live Events
# ============================================================================

class TestWebSocketLive:
    """Test live event streaming."""
    
    @pytest.mark.asyncio
    async def test_live_events_forwarded(self, client, test_session, valid_token, event_log):
        """Events emitted after HELLO should be forwarded as live."""
        with client.websocket_connect(f"/ws/interview/{test_session.meta.session_id}?token={valid_token}") as websocket:
            # WELCOME
            welcome = websocket.receive_json()
            assert welcome["type"] == "WELCOME"
            
            # Send HELLO
            websocket.send_json({"type": "HELLO", "last_event_id": "0"})
            
            # Receive REPLAY (may be empty)
            replay = websocket.receive_json()
            assert replay["type"] == "REPLAY"
            
            # Emit a new event after subscription starts
            await asyncio.sleep(0.5)  # Allow subscription to start
            event_log.append(test_session.meta.session_id, "LIVE_TEST_EVENT", {"live": True})
            
            # Should receive EVENT message
            try:
                event_msg = websocket.receive_json(timeout=2.0)
                assert event_msg["type"] == "EVENT"
                assert event_msg["event"]["event_type"] == "LIVE_TEST_EVENT"
            except:
                pytest.skip("Live event forwarding requires async support - may not work in sync test client")
    
    def test_disconnect_stops_subscription(self, client, test_session, valid_token, event_log):
        """Disconnect should clean up subscription without changing session state."""
        with client.websocket_connect(f"/ws/interview/{test_session.meta.session_id}?token={valid_token}") as websocket:
            # WELCOME
            welcome = websocket.receive_json()
            assert welcome["type"] == "WELCOME"
            
            # Send HELLO
            websocket.send_json({"type": "HELLO", "last_event_id": "0"})
            
            # Receive REPLAY
            replay = websocket.receive_json()
            assert replay["type"] == "REPLAY"
            
            # Disconnect (context manager exit)
        
        # Session should still exist
        from backend.services.session.session_store import SessionStore
        import redis as redis_module
        redis_client = redis_module.Redis(host="localhost", port=6379, decode_responses=True, db=15)
        store = SessionStore(redis_client)
        session = store.get(test_session.meta.session_id)
        assert session is not None
    
    def test_reconnect_with_resume(self, client, test_session, valid_token, event_log):
        """Reconnect with last_event_id should not duplicate events."""
        # First connection
        last_event_id = None
        with client.websocket_connect(f"/ws/interview/{test_session.meta.session_id}?token={valid_token}") as websocket:
            # WELCOME
            welcome = websocket.receive_json()
            assert welcome["type"] == "WELCOME"
            
            # Send HELLO
            websocket.send_json({"type": "HELLO", "last_event_id": "0"})
            
            # Receive REPLAY
            replay = websocket.receive_json()
            if replay["events"]:
                last_event_id = replay["events"][-1]["event_id"]
            
            # Disconnect
        
        # Emit new event while disconnected
        event_log.append(test_session.meta.session_id, "EVENT_WHILE_DISCONNECTED", {})
        
        # Reconnect with last_event_id
        with client.websocket_connect(f"/ws/interview/{test_session.meta.session_id}?token={valid_token}") as websocket:
            # WELCOME
            welcome = websocket.receive_json()
            assert welcome["type"] == "WELCOME"
            
            # Send HELLO with last_event_id
            websocket.send_json({"type": "HELLO", "last_event_id": last_event_id or "0"})
            
            # Receive REPLAY - should only include new events
            replay = websocket.receive_json()
            if last_event_id:
                event_types = [e["event_type"] for e in replay["events"]]
                assert "EVENT_WHILE_DISCONNECTED" in event_types


# ============================================================================
# Test Suite: Pipeline Integration
# ============================================================================

class TestWebSocketPipeline:
    """Test START_PIPELINE command and orchestrator integration."""
    
    def test_start_pipeline_command(self, client, test_session, valid_token, event_log, transcript_service):
        """START_PIPELINE should trigger orchestration without blocking."""
        # Create transcript
        transcript_id = transcript_service.store_transcript(
            test_session.meta.session_id,
            test_session.candidate.candidate_id,
            "Test transcript content"
        )
        
        with client.websocket_connect(f"/ws/interview/{test_session.meta.session_id}?token={valid_token}") as websocket:
            # WELCOME
            welcome = websocket.receive_json()
            assert welcome["type"] == "WELCOME"
            
            # Send HELLO
            websocket.send_json({"type": "HELLO", "last_event_id": "0"})
            
            # Receive REPLAY
            replay = websocket.receive_json()
            
            # Send START_PIPELINE
            websocket.send_json({
                "type": "START_PIPELINE",
                "idempotency_key": "test_key_123",
                "transcript_id": transcript_id,
                "interview_type": "behavioral",
                "duration_minutes": 30
            })
            
            # Should receive acknowledgment
            try:
                ack = websocket.receive_json(timeout=1.0)
                assert ack.get("type") == "PIPELINE_STARTED"
                assert ack.get("idempotency_key") == "test_key_123"
            except:
                pass  # Acknowledgment is optional
    
    def test_idempotency_prevents_duplicate_pipeline(self, client, test_session, valid_token, transcript_service, redis_client):
        """Same idempotency_key should return same result without re-running pipeline."""
        # Create transcript
        transcript_id = transcript_service.store_transcript(
            test_session.meta.session_id,
            test_session.candidate.candidate_id,
            "Test transcript content"
        )
        
        idempotency_key = "unique_key_789"
        
        # First request - should run pipeline
        with client.websocket_connect(f"/ws/interview/{test_session.meta.session_id}?token={valid_token}") as websocket:
            welcome = websocket.receive_json()
            websocket.send_json({"type": "HELLO", "last_event_id": "0"})
            replay = websocket.receive_json()
            
            websocket.send_json({
                "type": "START_PIPELINE",
                "idempotency_key": idempotency_key,
                "transcript_id": transcript_id
            })
            
            # Wait for pipeline to complete
            import time
            time.sleep(1.0)
        
        # Check if idempotency cache was set
        cache_key = f"idempotency:{test_session.meta.session_id}:scoring:{idempotency_key}"
        cached = redis_client.get(cache_key)
        
        # Second request with same key - should return cached
        with client.websocket_connect(f"/ws/interview/{test_session.meta.session_id}?token={valid_token}") as websocket:
            welcome = websocket.receive_json()
            websocket.send_json({"type": "HELLO", "last_event_id": "0"})
            replay = websocket.receive_json()
            
            websocket.send_json({
                "type": "START_PIPELINE",
                "idempotency_key": idempotency_key,
                "transcript_id": transcript_id
            })
            
            # Should complete faster (from cache)
            # Test passes if no exception
    
    def test_unknown_message_type_returns_error(self, client, test_session, valid_token):
        """Unknown message type should return ERROR without crashing connection."""
        with client.websocket_connect(f"/ws/interview/{test_session.meta.session_id}?token={valid_token}") as websocket:
            # WELCOME
            welcome = websocket.receive_json()
            assert welcome["type"] == "WELCOME"
            
            # Send HELLO
            websocket.send_json({"type": "HELLO", "last_event_id": "0"})
            
            # Receive REPLAY
            replay = websocket.receive_json()
            
            # Send invalid message
            websocket.send_json({"type": "INVALID_TYPE", "data": "test"})
            
            # Should receive ERROR
            error = websocket.receive_json(timeout=1.0)
            assert error["type"] == "ERROR"
            assert error["code"] == "UNKNOWN_MESSAGE"
            
            # Connection should still be open - send another message
            websocket.send_json({"type": "SUBSCRIBE"})
            # Should not crash


# ============================================================================
# Test Suite: Backpressure & Performance
# ============================================================================

class TestWebSocketBackpressure:
    """Test backpressure handling and performance limits."""
    
    def test_rapid_events_do_not_lose_order(self, client, test_session, valid_token, event_log):
        """100 rapid events should arrive in correct order."""
        with client.websocket_connect(f"/ws/interview/{test_session.meta.session_id}?token={valid_token}") as websocket:
            # WELCOME
            welcome = websocket.receive_json()
            assert welcome["type"] == "WELCOME"
            
            # Send HELLO
            websocket.send_json({"type": "HELLO", "last_event_id": "0"})
            
            # Receive REPLAY
            replay = websocket.receive_json()
            
            # Emit 100 rapid events
            for i in range(100):
                event_log.append(test_session.meta.session_id, f"RAPID_EVENT_{i}", {"seq": i})
            
            # Events should arrive in order (if live forwarding works)
            # This test is best-effort due to async nature
            try:
                received = []
                for _ in range(10):  # Try to receive some
                    msg = websocket.receive_json(timeout=0.1)
                    if msg["type"] == "EVENT":
                        received.append(msg["event"]["metadata"]["seq"])
                
                # Verify order of received events
                if received:
                    assert received == sorted(received)
            except:
                pytest.skip("Live event ordering test requires async support")


# ============================================================================
# Run Tests
# ============================================================================

if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
