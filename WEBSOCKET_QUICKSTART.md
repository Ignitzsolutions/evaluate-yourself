# WebSocket Interview Channel - Quick Start Guide

## For Frontend Developers

### Connection URL
```
ws://localhost:8000/ws/interview/{session_id}?token={jwt_token}
```

### Connection Flow

#### 1. Establish Connection
```javascript
const sessionId = "abc123";
const token = "your_jwt_token_here";
const ws = new WebSocket(`ws://localhost:8000/ws/interview/${sessionId}?token=${token}`);

ws.onopen = () => {
  console.log("✅ WebSocket connected");
};
```

#### 2. Receive WELCOME
```javascript
ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  
  if (message.type === "WELCOME") {
    console.log("✅ Server acknowledged:", message.session_id);
    // Send HELLO to start receiving events
    ws.send(JSON.stringify({
      type: "HELLO",
      last_event_id: "0"  // or use stored event ID to resume
    }));
  }
};
```

#### 3. Receive REPLAY (Historical Events)
```javascript
if (message.type === "REPLAY") {
  console.log(`📦 Replay chunk ${message.chunk_index + 1}/${message.total_chunks}`);
  message.events.forEach(event => {
    console.log(`  - ${event.event_type} at ${event.timestamp}`);
    // Update UI based on event type
  });
}
```

#### 4. Receive Live Events
```javascript
if (message.type === "EVENT") {
  const event = message.event;
  console.log(`🔴 LIVE: ${event.event_type}`);
  
  switch (event.event_type) {
    case "SCORING_STARTED":
      // Show "Scoring in progress..." indicator
      break;
    case "SCORING_COMPLETED":
      // Display scorecard: event.metadata.scorecard_id
      break;
    case "FEEDBACK_GENERATED":
      // Display feedback: event.metadata.feedback_id
      break;
  }
}
```

#### 5. Start Interview Processing (Optional)
```javascript
// Trigger orchestration from WebSocket
function startPipeline(transcriptId) {
  ws.send(JSON.stringify({
    type: "START_PIPELINE",
    idempotency_key: `key_${Date.now()}`,  // Unique key per request
    transcript_id: transcriptId,
    interview_type: "behavioral",
    duration_minutes: 30
  }));
}
```

### Complete Example

```javascript
class InterviewWebSocket {
  constructor(sessionId, token) {
    this.sessionId = sessionId;
    this.token = token;
    this.ws = null;
    this.lastEventId = localStorage.getItem(`last_event_${sessionId}`) || "0";
    this.eventHandlers = {};
  }
  
  connect() {
    this.ws = new WebSocket(
      `ws://localhost:8000/ws/interview/${this.sessionId}?token=${this.token}`
    );
    
    this.ws.onopen = () => this.onOpen();
    this.ws.onmessage = (event) => this.onMessage(event);
    this.ws.onerror = (error) => this.onError(error);
    this.ws.onclose = (event) => this.onClose(event);
  }
  
  onOpen() {
    console.log("✅ WebSocket connected");
  }
  
  onMessage(event) {
    const message = JSON.parse(event.data);
    
    switch (message.type) {
      case "WELCOME":
        console.log("✅ Received WELCOME");
        // Send HELLO to start replay
        this.ws.send(JSON.stringify({
          type: "HELLO",
          last_event_id: this.lastEventId
        }));
        break;
      
      case "REPLAY":
        console.log(`📦 Replay chunk ${message.chunk_index + 1}/${message.total_chunks}`);
        message.events.forEach(evt => this.handleEvent(evt));
        
        // Save last event ID for resume on reconnect
        if (message.events.length > 0) {
          const lastEvent = message.events[message.events.length - 1];
          this.lastEventId = lastEvent.event_id;
          localStorage.setItem(`last_event_${this.sessionId}`, this.lastEventId);
        }
        break;
      
      case "EVENT":
        console.log(`🔴 LIVE: ${message.event.event_type}`);
        this.handleEvent(message.event);
        
        // Save last event ID
        this.lastEventId = message.event.event_id;
        localStorage.setItem(`last_event_${this.sessionId}`, this.lastEventId);
        break;
      
      case "ERROR":
        console.error(`❌ Server error: ${message.code} - ${message.message}`);
        break;
      
      case "PIPELINE_STARTED":
        console.log(`✅ Pipeline started: ${message.idempotency_key}`);
        break;
    }
  }
  
  handleEvent(event) {
    // Call registered handlers
    const handler = this.eventHandlers[event.event_type];
    if (handler) {
      handler(event);
    }
    
    // Default UI updates
    switch (event.event_type) {
      case "SESSION_CREATED":
        console.log("📝 Session created");
        break;
      case "TRANSCRIPT_ATTACHED":
        console.log("📄 Transcript attached:", event.metadata.transcript_id);
        break;
      case "SCORING_STARTED":
        this.showLoadingIndicator("Scoring interview...");
        break;
      case "SCORING_COMPLETED":
        this.hideLoadingIndicator();
        this.loadScorecard(event.metadata.scorecard_id);
        break;
      case "FEEDBACK_STARTED":
        this.showLoadingIndicator("Generating feedback...");
        break;
      case "FEEDBACK_GENERATED":
        this.hideLoadingIndicator();
        this.loadFeedback(event.metadata.feedback_id);
        break;
      case "ERROR":
        this.showError(event.metadata.error_message);
        break;
    }
  }
  
  on(eventType, handler) {
    this.eventHandlers[eventType] = handler;
  }
  
  startPipeline(transcriptId, interviewType = "behavioral", duration = 30) {
    const idempotencyKey = `pipeline_${Date.now()}_${Math.random()}`;
    
    this.ws.send(JSON.stringify({
      type: "START_PIPELINE",
      idempotency_key: idempotencyKey,
      transcript_id: transcriptId,
      interview_type: interviewType,
      duration_minutes: duration
    }));
    
    return idempotencyKey;
  }
  
  onError(error) {
    console.error("❌ WebSocket error:", error);
  }
  
  onClose(event) {
    console.log(`🔌 WebSocket closed: ${event.code} - ${event.reason}`);
    
    // Attempt reconnect after 3 seconds
    setTimeout(() => {
      console.log("🔄 Attempting reconnect...");
      this.connect();
    }, 3000);
  }
  
  disconnect() {
    if (this.ws) {
      this.ws.close();
    }
  }
  
  // UI helper methods (implement based on your framework)
  showLoadingIndicator(message) {
    console.log(`⏳ ${message}`);
  }
  
  hideLoadingIndicator() {
    console.log(`✅ Loading complete`);
  }
  
  loadScorecard(scorecardId) {
    console.log(`📊 Loading scorecard: ${scorecardId}`);
    // Fetch scorecard from API: GET /api/scorecards/${scorecardId}
  }
  
  loadFeedback(feedbackId) {
    console.log(`💬 Loading feedback: ${feedbackId}`);
    // Fetch feedback from API: GET /api/feedback/${feedbackId}
  }
  
  showError(message) {
    console.error(`❌ ${message}`);
  }
}

// Usage
const interview = new InterviewWebSocket("session_abc123", "jwt_token_here");

// Register event handlers
interview.on("SCORING_COMPLETED", (event) => {
  console.log("✅ Score available:", event.metadata.scorecard_id);
});

interview.on("FEEDBACK_GENERATED", (event) => {
  console.log("✅ Feedback available:", event.metadata.feedback_id);
});

// Connect
interview.connect();

// Later: start processing
interview.startPipeline("transcript_123", "behavioral", 30);

// On component unmount
interview.disconnect();
```

---

## Event Types Reference

### Session Events
| Event Type | When Emitted | Metadata Fields |
|------------|-------------|-----------------|
| `SESSION_CREATED` | Session initialized | - |
| `TRANSCRIPT_ATTACHED` | Transcript uploaded | `transcript_id` |
| `SCORING_STARTED` | Scoring begins | `transcript_id`, `correlation_id` |
| `SCORING_COMPLETED` | Scoring done | `scorecard_id`, `correlation_id` |
| `FEEDBACK_STARTED` | Feedback generation begins | `scorecard_id`, `correlation_id` |
| `FEEDBACK_GENERATED` | Feedback ready | `feedback_id`, `correlation_id` |
| `ERROR` | Error occurred | `error_message`, `correlation_id` |
| `COMPLETED` | Interview complete | - |

---

## Error Handling

### WebSocket Close Codes
| Code | Meaning | Action |
|------|---------|--------|
| 4401 | Unauthorized | Get new token, reconnect |
| 4403 | Forbidden | Session expired, redirect to login |
| 4408 | Timeout | Reconnect with valid token |
| 1000 | Normal closure | No action needed |
| 1011 | Server error | Wait 5s, reconnect |

### Reconnection Strategy
```javascript
let reconnectAttempts = 0;
const maxReconnectAttempts = 5;

function reconnect() {
  if (reconnectAttempts >= maxReconnectAttempts) {
    console.error("❌ Max reconnection attempts reached");
    showErrorToUser("Connection lost. Please refresh the page.");
    return;
  }
  
  reconnectAttempts++;
  const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000); // Exponential backoff, max 30s
  
  console.log(`🔄 Reconnecting in ${delay}ms (attempt ${reconnectAttempts}/${maxReconnectAttempts})`);
  
  setTimeout(() => {
    interview.connect();
  }, delay);
}

interview.ws.onclose = (event) => {
  if (event.code !== 1000) {  // Not normal closure
    reconnect();
  }
};

interview.ws.onopen = () => {
  reconnectAttempts = 0;  // Reset on successful connection
};
```

---

## Testing Locally

### 1. Start Backend
```bash
cd backend
source ../venv/bin/activate  # or your virtualenv path
uvicorn app:app --reload --host 0.0.0.0 --port 8000
```

### 2. Start Redis
```bash
redis-server
```

### 3. Create Session (via API)
```bash
curl -X POST http://localhost:8000/api/sessions \
  -H "Content-Type: application/json" \
  -d '{
    "candidate_id": "test_candidate",
    "tenant_id": "test_tenant",
    "email": "test@example.com"
  }'
```

Response:
```json
{
  "session_id": "abc123...",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### 4. Connect WebSocket (Browser Console)
```javascript
const ws = new WebSocket("ws://localhost:8000/ws/interview/abc123?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...");

ws.onmessage = (e) => console.log(JSON.parse(e.data));

ws.onopen = () => {
  ws.send(JSON.stringify({type: "HELLO", last_event_id: "0"}));
};
```

---

## FAQ

**Q: What if I miss some events while disconnected?**  
A: Send the last `event_id` you received in the HELLO message. The server will replay all events after that ID.

**Q: Can I have multiple WebSocket connections for the same session?**  
A: Yes, but each connection must have a valid token. All connections will receive the same events.

**Q: How long do events persist in Redis?**  
A: Events have a 90-day TTL. After that, they're automatically deleted.

**Q: What happens if the server restarts?**  
A: Sessions and events are persisted in Redis (with AOF/RDB). Your next reconnection will work seamlessly.

**Q: Can I trigger orchestration without WebSocket?**  
A: Yes, call the HTTP API endpoint: `POST /api/interview/evaluate`. WebSocket is for realtime updates only.

**Q: How do I know when processing is complete?**  
A: Listen for `FEEDBACK_GENERATED` event, then the pipeline is done.

**Q: Can I cancel a running pipeline?**  
A: Not currently supported. Idempotency prevents duplicates, so retrying is safe.

---

## Support

**Documentation**: See [PHASE3_COMPLETE.md](PHASE3_COMPLETE.md) for full details  
**Tests**: Run `pytest backend/tests/test_websocket_realtime.py -v`  
**Issues**: Check Redis logs, FastAPI logs, and browser console for errors
