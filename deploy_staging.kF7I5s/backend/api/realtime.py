"""WebSocket realtime endpoint for interview event streaming."""

import logging
import json
import asyncio
import uuid
from typing import Optional, Dict, Any, AsyncIterator
from datetime import datetime
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from pydantic import BaseModel, Field, ConfigDict
import redis

from services.auth.token_service import TokenService
from services.session.session_manager import SessionManager
from services.session.session_events import SessionEventLog

logger = logging.getLogger(__name__)

router = APIRouter()


# ============================================================================
# Message Schemas (Pydantic)
# ============================================================================

class HelloMessage(BaseModel):
    """Client → Server: Handshake with optional resume from event ID."""
    type: str = Field("HELLO", pattern="^HELLO$")
    last_event_id: Optional[str] = "0"
    model_config = ConfigDict(extra="forbid")


class SubscribeMessage(BaseModel):
    """Client → Server: Subscribe to live events."""
    type: str = Field("SUBSCRIBE", pattern="^SUBSCRIBE$")
    model_config = ConfigDict(extra="forbid")


class StartPipelineMessage(BaseModel):
    """Client → Server: Trigger interview processing pipeline."""
    type: str = Field("START_PIPELINE", pattern="^START_PIPELINE$")
    idempotency_key: str
    transcript_id: str
    interview_type: Optional[str] = "behavioral"
    duration_minutes: Optional[int] = 0
    model_config = ConfigDict(extra="forbid")


class WelcomeMessage(BaseModel):
    """Server → Client: Connection acknowledged."""
    type: str = "WELCOME"
    session_id: str
    now: str
    connection_id: str


class ReplayMessage(BaseModel):
    """Server → Client: Historical events."""
    type: str = "REPLAY"
    events: list
    resumed_from_id: str
    chunk_index: int
    total_chunks: int


class EventMessage(BaseModel):
    """Server → Client: Live event."""
    type: str = "EVENT"
    event: Dict[str, Any]


class ErrorMessage(BaseModel):
    """Server → Client: Error notification."""
    type: str = "ERROR"
    code: str
    message: str


# ============================================================================
# WebSocket Endpoint
# ============================================================================

@router.websocket("/interview/{session_id}")
async def websocket_interview_endpoint(
    websocket: WebSocket,
    session_id: str,
    token: Optional[str] = Query(None)
):
    """
    WebSocket endpoint for interview event streaming.
    
    Authentication:
        - Token via query param: ?token=xxx
        - OR Authorization header: Bearer xxx
    
    Message Protocol:
        Client → Server:
            - HELLO (with last_event_id for resume)
            - SUBSCRIBE
            - START_PIPELINE (with idempotency_key, transcript_id)
        Server → Client:
            - WELCOME
            - REPLAY (chunked historical events)
            - EVENT (live events)
            - ERROR
    """
    connection_id = str(uuid.uuid4())
    logger.info(f"[{connection_id}] WebSocket connection attempt for session {session_id}")
    
    # Dependencies (use centralized Redis client)
    from db.redis_client import get_redis_client
    redis_client = get_redis_client()
    token_service = TokenService()
    from services.session.session_store import SessionStore
    session_store = SessionStore(redis_client)
    session_manager = SessionManager(session_store)
    event_log = SessionEventLog(redis_client)
    
    # Shared state
    subscribed = False
    subscription_task = None
    
    try:
        # ====================================================================
        # 1. Accept connection
        # ====================================================================
        await websocket.accept()
        logger.info(f"[{connection_id}] WebSocket accepted")
        
        # ====================================================================
        # 2. Authenticate
        # ====================================================================
        auth_header = websocket.headers.get("Authorization")
        extracted_token = token if token else None
        if auth_header and auth_header.startswith("Bearer "):
            extracted_token = auth_header[7:]
        
        if not extracted_token:
            logger.warning(f"[{connection_id}] No token provided")
            await websocket.close(code=4401, reason="Unauthorized: No token")
            return
        
        # Validate token
        claims = token_service.validate_token(extracted_token)
        if not claims:
            logger.warning(f"[{connection_id}] Invalid token")
            await websocket.close(code=4401, reason="Unauthorized: Invalid token")
            return
        
        token_session_id = claims.get("session_id")
        tenant_id = claims.get("tenant_id")
        candidate_id = claims.get("candidate_id")
        
        # Cross-check session_id
        if token_session_id != session_id:
            logger.warning(f"[{connection_id}] Session ID mismatch: {token_session_id} != {session_id}")
            await websocket.close(code=4403, reason="Forbidden: Session ID mismatch")
            return
        
        # Validate session exists
        session = session_manager.get_session(session_id)
        if not session:
            logger.warning(f"[{connection_id}] Session not found: {session_id}")
            await websocket.close(code=4408, reason="Session expired or not found")
            return
        
        # Validate tenant isolation
        if session.candidate.tenant_id != tenant_id:
            logger.warning(f"[{connection_id}] Tenant mismatch: {tenant_id} != {session.candidate.tenant_id}")
            await websocket.close(code=4403, reason="Forbidden: Tenant mismatch")
            return
        
        logger.info(f"[{connection_id}] Authentication successful for session {session_id}")
        
        # ====================================================================
        # 3. Send WELCOME
        # ====================================================================
        welcome = WelcomeMessage(
            type="WELCOME",
            session_id=session_id,
            now=datetime.utcnow().isoformat(),
            connection_id=connection_id
        )
        await websocket.send_json(welcome.model_dump())
        logger.info(f"[{connection_id}] Sent WELCOME")
        
        # ====================================================================
        # 4. Wait for HELLO (with timeout)
        # ====================================================================
        try:
            hello_data = await asyncio.wait_for(websocket.receive_json(), timeout=5.0)
            hello = HelloMessage(**hello_data)
            last_event_id = hello.last_event_id or "0"
            logger.info(f"[{connection_id}] Received HELLO with last_event_id={last_event_id}")
        except asyncio.TimeoutError:
            logger.warning(f"[{connection_id}] HELLO timeout")
            await websocket.close(code=4408, reason="HELLO timeout")
            return
        except Exception as e:
            logger.error(f"[{connection_id}] Error parsing HELLO: {e}")
            error = ErrorMessage(type="ERROR", code="INVALID_MESSAGE", message=str(e))
            await websocket.send_json(error.model_dump())
            await websocket.close(code=1003, reason="Invalid message")
            return
        
        # ====================================================================
        # 5. REPLAY missed events (chunked)
        # ====================================================================
        replay_events = event_log.get_events_replay(session_id, after_event_id=last_event_id, limit=10000)
        
        chunk_size = 100
        total_chunks = (len(replay_events) + chunk_size - 1) // chunk_size
        
        for chunk_idx in range(total_chunks):
            chunk_events = replay_events[chunk_idx * chunk_size : (chunk_idx + 1) * chunk_size]
            replay = ReplayMessage(
                type="REPLAY",
                events=chunk_events,
                resumed_from_id=last_event_id,
                chunk_index=chunk_idx,
                total_chunks=total_chunks
            )
            await websocket.send_json(replay.model_dump())
            logger.debug(f"[{connection_id}] Sent REPLAY chunk {chunk_idx + 1}/{total_chunks} ({len(chunk_events)} events)")
        
        logger.info(f"[{connection_id}] Replay complete: {len(replay_events)} events in {total_chunks} chunks")
        
        # ====================================================================
        # 6. Start live event subscription
        # ====================================================================
        async def live_event_forwarder():
            """Background task to forward live events."""
            try:
                async for event in event_log.get_events_stream_subscription(session_id):
                    if not subscribed:
                        break
                    
                    event_msg = EventMessage(type="EVENT", event=event)
                    await websocket.send_json(event_msg.model_dump())
                    logger.debug(f"[{connection_id}] Forwarded live event: {event.get('event_type')}")
            except Exception as e:
                logger.error(f"[{connection_id}] Error in live event forwarder: {e}")
        
        subscribed = True
        subscription_task = asyncio.create_task(live_event_forwarder())
        logger.info(f"[{connection_id}] Live subscription started")
        
        # ====================================================================
        # 7. Listen for client messages
        # ====================================================================
        while True:
            try:
                data = await websocket.receive_json()
                msg_type = data.get("type")
                
                if msg_type == "SUBSCRIBE":
                    # Already subscribed
                    logger.debug(f"[{connection_id}] Received SUBSCRIBE (already active)")
                
                elif msg_type == "START_PIPELINE":
                    # Start interview processing pipeline
                    try:
                        pipeline_msg = StartPipelineMessage(**data)
                        logger.info(f"[{connection_id}] Received START_PIPELINE: {pipeline_msg.transcript_id}")
                        
                        # Launch orchestration as background task (non-blocking)
                        from services.interview.transcript_service import TranscriptService
                        from services.interview.scoring_service import ScoringService
                        from services.interview.orchestrator import InterviewOrchestrator
                        
                        transcript_service = TranscriptService()
                        scoring_service = ScoringService()
                        orchestrator = InterviewOrchestrator(
                            session_manager, event_log, transcript_service, scoring_service, redis_client
                        )
                        
                        async def run_pipeline():
                            """Run orchestration asynchronously."""
                            try:
                                result = orchestrator.evaluate_interview(
                                    session_id=session_id,
                                    transcript_id=pipeline_msg.transcript_id,
                                    interview_type=pipeline_msg.interview_type,
                                    duration_minutes=pipeline_msg.duration_minutes,
                                    idempotency_key=pipeline_msg.idempotency_key
                                )
                                logger.info(f"[{connection_id}] Pipeline complete: {result}")
                            except Exception as e:
                                logger.error(f"[{connection_id}] Pipeline error: {e}")
                        
                        asyncio.create_task(run_pipeline())
                        
                        # Send acknowledgment (optional)
                        ack = {"type": "PIPELINE_STARTED", "idempotency_key": pipeline_msg.idempotency_key}
                        await websocket.send_json(ack)
                    
                    except Exception as e:
                        logger.error(f"[{connection_id}] Error processing START_PIPELINE: {e}")
                        error = ErrorMessage(type="ERROR", code="PIPELINE_ERROR", message=str(e))
                        await websocket.send_json(error.model_dump())
                
                else:
                    # Unknown message type
                    logger.warning(f"[{connection_id}] Unknown message type: {msg_type}")
                    error = ErrorMessage(type="ERROR", code="UNKNOWN_MESSAGE", message=f"Unknown type: {msg_type}")
                    await websocket.send_json(error.model_dump())
            
            except WebSocketDisconnect:
                logger.info(f"[{connection_id}] Client disconnected")
                break
            except Exception as e:
                logger.error(f"[{connection_id}] Error receiving message: {e}")
                break
    
    except WebSocketDisconnect:
        logger.info(f"[{connection_id}] WebSocket disconnected during handshake")
    except Exception as e:
        logger.error(f"[{connection_id}] WebSocket error: {e}")
        try:
            await websocket.close(code=1011, reason="Internal server error")
        except:
            pass
    finally:
        # ====================================================================
        # 8. Cleanup
        # ====================================================================
        subscribed = False
        if subscription_task:
            subscription_task.cancel()
            try:
                await subscription_task
            except asyncio.CancelledError:
                pass
        
        logger.info(f"[{connection_id}] Connection closed for session {session_id}")
