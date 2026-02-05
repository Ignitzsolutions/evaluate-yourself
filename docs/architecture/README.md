# Architecture Diagrams Guide

This directory contains comprehensive architectural diagrams for the Evaluate-Yourself interview platform.

## Diagrams Overview

1. **01-system-architecture.drawio** - Complete system architecture with all layers
2. **02-interview-process-flow.drawio** - End-to-end interview process flow
3. **03-data-flow.drawio** - Data flow between components
4. **04-database-schema.drawio** - Database schema and relationships

## Prerequisites

Install Draw.io Extension in VS Code:
```bash
code --install-extension hediet.vscode-drawio
```

Or via VS Code UI:
1. Open Extensions (Cmd+Shift+X)
2. Search "Draw.io Integration"
3. Install "Draw.io Integration" by Henning Dieterichs

## How to Edit

1. Open any `.drawio` file in VS Code - it will open in the Draw.io editor
2. Use the shapes panel on the left to add components
3. Use the format panel on the right to style elements
4. Save automatically (Cmd+S)

## Color Scheme

Use these consistent colors across all diagrams:

- **Frontend Layer**: Blue (#dae8fc with #6c8ebf stroke)
- **Backend Layer**: Green (#d5e8d4 with #82b366 stroke)
- **Data Layer**: Yellow (#fff2cc with #d6b656 stroke)
- **External Services**: Red (#f8cecc with #b85450 stroke)
- **Infrastructure**: Gray (#f5f5f5 with #666666 stroke)

## Connection Types

- **Solid Blue Arrow** (→): HTTP REST API calls
- **Solid Red Arrow** (→): Real-time WebSocket connections
- **Dashed Green Arrow** (→): Authentication flow (JWT)
- **Solid Purple Arrow** (↔): Redis pub/sub or streams
- **Solid Orange Arrow** (→): Database queries

## Diagram 1: System Architecture (Swimlanes)

**Layout**: Horizontal swimlanes (4 layers)

**Swimlane 1 - Frontend (Blue)**
- React App (Port 3000)
  - Material-UI components
  - Clerk authentication
  - State management (Context API)
- Interview Room
  - WebRTC peer connection
  - Real-time audio streaming
  - Transcript display
- Report Page
  - Feedback polling (3s intervals)
  - Statistics cards

**Swimlane 2 - Backend (Green)**
- FastAPI Application (Port 8000)
  - REST endpoints
  - WebSocket proxy
  - JWT validation
- Azure OpenAI Realtime Client
  - Session management
  - Audio streaming
  - Whisper transcription
- LangChain Feedback Pipeline
  - Structured output (Pydantic)
  - Candidate evaluation
  - Report generation

**Swimlane 3 - Data Layer (Yellow)**
- Redis (Port 6379)
  - Session state
  - Idempotency locks
  - Event streams
- SQLite/PostgreSQL
  - Users & interviews
  - Transcripts & reports
  - JSONB feedback storage
- Local Filesystem
  - Transcript archives
  - Session logs

**Swimlane 4 - External Services (Red)**
- Azure OpenAI (Sweden Central)
  - gpt-realtime deployment
  - Whisper ASR
  - API version: 2024-08-28
- Clerk (engaging-gazelle-52)
  - User authentication
  - Session management
  - JWKS validation

**Connections**:
- Frontend → Backend: Blue solid (HTTP REST + WebSocket)
- Backend → Azure OpenAI: Red solid (WebSocket realtime)
- Backend → Redis: Purple solid (pub/sub)
- Backend → Database: Orange solid (SQLAlchemy)
- Frontend → Clerk: Green dashed (JWT auth)

## Diagram 2: Interview Process Flow (Vertical)

**Layout**: Vertical flowchart (top to bottom)

1. **User Authentication** (Blue)
   - Login via Clerk
   - Receive JWT token

2. **Dashboard Access** (Blue)
   - View interview options
   - Select interview type

3. **Session Initialization** (Green)
   - POST /api/interview/init
   - Create session in Redis
   - Generate session_id

4. **WebSocket Connection** (Red)
   - Frontend → Backend WebSocket
   - Backend → Azure OpenAI WebSocket
   - Establish audio pipeline

5. **Audio Streaming** (Red)
   - User speaks → WebRTC capture
   - Base64 encode audio chunks
   - Stream to Azure OpenAI

6. **Real-time Transcription** (Red)
   - Whisper ASR processes audio
   - Transcripts marked "realtime_asr"
   - Display in UI immediately

7. **AI Response Generation** (Red)
   - Azure OpenAI generates questions
   - Response marked "assistant_text"
   - Stream audio back to user

8. **End Interview** (Blue/Green)
   - User clicks "End Call"
   - POST /api/transcript/save
   - Save canonical format to DB

9. **Feedback Generation Trigger** (Green)
   - Fire-and-forget POST to /generate-feedback
   - Redis lock acquired
   - User navigates to report

10. **Report Display** (Blue)
    - Show statistics immediately
    - Poll every 3s for feedback
    - Display loading indicator

11. **Feedback Completion** (Green/Blue)
    - LangChain generates structured output
    - Save to InterviewReport.ai_feedback
    - Polling detects completion
    - Render feedback in UI

**Decision Points**:
- Diamond: "Feedback ready?" (after step 10)
  - No → Continue polling (max 20 attempts)
  - Yes → Display feedback

## Diagram 3: Data Flow (Circular)

**Layout**: Circular flow with 4 main data paths

**Path 1: Audio Flow** (Red circle, clockwise)
- User microphone → WebRTC capture
- Frontend encodes Base64
- WebSocket to backend
- Proxy to Azure OpenAI
- Whisper transcription
- Transcript back to frontend
- Display in UI

**Path 2: Transcript Persistence** (Orange circle, clockwise)
- Transcript array in memory
- POST /transcript/save
- Canonical format validation
- SQLAlchemy ORM
- Database storage (JSONB)
- Transcript ID returned

**Path 3: Feedback Generation** (Purple circle, clockwise)
- POST /generate-feedback
- Redis lock check/acquire
- Load transcript from DB
- LangChain chain.invoke()
- Pydantic validation
- Save to ai_feedback column
- SessionEventLog event

**Path 4: Report Display** (Blue circle, clockwise)
- GET /report/{session_id}
- Load from database
- Check ai_feedback column
- Return JSON response
- Frontend polls (3s intervals)
- Render feedback when ready

**Central Hub**: Backend FastAPI (green center node with 4 connections)

## Diagram 4: Database Schema (ER Diagram)

**Layout**: Entity-relationship diagram

**Entity: User**
- Fields:
  - id (PK, VARCHAR)
  - name (VARCHAR)
  - email (VARCHAR, UNIQUE)
  - created_at (TIMESTAMP)
- Relationships:
  - One-to-many → InterviewSession

**Entity: InterviewSession**
- Fields:
  - id (PK, VARCHAR)
  - user_id (FK → User.id)
  - session_id (VARCHAR, UNIQUE, indexed)
  - status (ENUM: active/completed/error)
  - started_at (TIMESTAMP)
  - ended_at (TIMESTAMP, nullable)
  - metadata (JSONB)
- Relationships:
  - Many-to-one → User
  - One-to-one → InterviewReport
  - One-to-many → Transcript
  - One-to-many → SessionEventLog

**Entity: Transcript**
- Fields:
  - id (PK, INTEGER)
  - session_id (FK → InterviewSession.session_id, indexed)
  - raw_messages (JSONB) ← Array of {speaker, text, timestamp, source}
  - canonical_format (JSONB) ← Validated structure
  - created_at (TIMESTAMP)
  - file_path (VARCHAR, nullable)
- JSONB Structure:
  ```json
  {
    "speaker": "user|ai",
    "text": "string",
    "timestamp": "ISO8601",
    "source": "realtime_asr|assistant_text|client_heuristic"
  }
  ```

**Entity: InterviewReport**
- Fields:
  - id (PK, INTEGER)
  - session_id (FK → InterviewSession.session_id, UNIQUE, indexed)
  - user_id (FK → User.id)
  - ai_feedback (JSONB, nullable) ← LangChain output
  - statistics (JSONB) ← {duration, word_count, questions}
  - created_at (TIMESTAMP)
  - updated_at (TIMESTAMP)
- JSONB ai_feedback Structure:
  ```json
  {
    "_structured": {
      "overall_summary": "string",
      "categories": {
        "Technical Skills": {"score": 8, "evidence": "...", "feedback": "..."},
        "Communication": {"score": 7, ...},
        "Problem Solving": {...},
        "Cultural Fit": {...}
      },
      "strengths": ["..."],
      "areas_for_improvement": ["..."],
      "recommendation": "string"
    },
    "_report_format": {...}
  }
  ```

**Entity: SessionEventLog**
- Fields:
  - id (PK, INTEGER)
  - session_id (FK → InterviewSession.session_id, indexed)
  - event_type (VARCHAR) ← SESSION_START, FEEDBACK_GENERATED, etc.
  - event_data (JSONB)
  - timestamp (TIMESTAMP, indexed)
- Use case: Audit trail, debugging, analytics

**Indexes**:
- InterviewSession.session_id (UNIQUE)
- InterviewSession.user_id (B-tree)
- Transcript.session_id (B-tree)
- InterviewReport.session_id (UNIQUE)
- SessionEventLog.session_id (B-tree)
- SessionEventLog.timestamp (B-tree)
- InterviewReport.ai_feedback (GIN index for JSONB queries in PostgreSQL)

**Notes Box** (bottom right):
- SQLite current, PostgreSQL planned
- Use JSONB for flexible schema
- Redis for session state (TTL: 1 hour)
- Alembic for migrations

## Tech Stack Reference

**Frontend:**
- React 18.2.0
- Material-UI v5
- Clerk Authentication
- WebRTC (getUserMedia + PeerConnection)

**Backend:**
- FastAPI 0.104.1
- Python 3.14
- Uvicorn (dev) / Gunicorn (prod)
- SQLAlchemy 2.0+

**AI/ML:**
- Azure OpenAI (gpt-realtime deployment)
- LangChain (langchain-core>=0.1.0, langchain-openai>=0.0.5)
- Pydantic for structured output

**Data:**
- Redis 5.0+ (Streams + Pub/Sub)
- SQLite (current) → PostgreSQL 16 (planned)
- Local filesystem → S3/MinIO (planned)

**Authentication:**
- Clerk
- Instance: engaging-gazelle-52
- JWT validation with JWKS

## Deployment Info

- **Frontend**: Port 3000 (React Dev Server)
- **Backend**: Port 8000 (Uvicorn)
- **Redis**: Port 6379
- **PostgreSQL**: Port 5432 (planned)
- **Azure OpenAI**: ignit-mk7zvb02-swedencentral.cognitiveservices.azure.com

## Export Guidelines

To share diagrams:
1. Right-click on diagram canvas
2. Select "Export As..."
3. Choose format:
   - **PNG** for README (transparent background, 300 DPI)
   - **SVG** for web (scalable, smaller file size)
   - **PDF** for documentation (print-ready)
4. Save to `docs/images/` directory
5. Reference in main README:
   ```markdown
   ![System Architecture](docs/images/system-architecture.png)
   ```

## Maintenance

When updating architecture:
1. Open relevant `.drawio` file
2. Make changes
3. Save (auto-commits to git)
4. Re-export PNG/SVG if referenced in docs
5. Update this README if new components added

## Common Tasks

**Add a new component:**
1. Draw rectangle with appropriate color
2. Add component name (bold, 14pt)
3. Add bullet points for features (regular, 11pt)
4. Connect to related components

**Add a new flow:**
1. Use connector tool (arrow)
2. Set appropriate color and style
3. Label the connection
4. Add description text if complex

**Modify existing diagram:**
1. Select element
2. Use format panel on right to modify
3. Maintain color consistency
4. Update connections if needed

---

**Created**: February 4, 2026  
**Last Updated**: February 4, 2026  
**Maintained by**: Development Team
