# Production Corrections — Evaluate Yourself
_Generated: 2026-04-25 | Status: In Progress_

## CRITICAL (Fix Before Any Public Access)

### C1 — `backend/.env.backup` committed with live secrets
**Action:** Rotate ALL credentials immediately (Azure OpenAI, Speech, Cognitive, Clerk), then remove file from git history:
```bash
git filter-repo --path backend/.env.backup --invert-paths
```
Add `*.backup` and `debug.log` to `.gitignore`.

### C2 — `GET /api/key` returns Azure Cognitive key to any caller (no auth)
**File:** `backend/app.py` ~line 942
**Action:** Delete this endpoint entirely. ✅ Fixed in this PR.

### C3 — `GET /api/token` returns raw OpenAI API key to any caller (no auth)
**File:** `backend/app.py` ~line 2311
**Action:** Replace with authenticated ephemeral session endpoint. ✅ Fixed in this PR.

### C4 — Hardcoded demo credentials backdoor in `src/context/AuthContext.jsx`
`email: "demo@example.com" / password: "demo123"` runs alongside Clerk auth.
**Action:** Delete `src/context/AuthContext.jsx`. ✅ Fixed in this PR.

### C5 — JWT secret defaults to `"dev-secret-change-in-prod"` if env var unset
**File:** `backend/services/auth/token_service.py` + `backend/services/auth/__init__.py`
**Action:** Fail fast if key missing in production; enforce minimum 32-char length. ✅ Fixed in this PR.

### C6 — `/api/realtime/ws` WebSocket proxy has no authentication
**File:** `backend/app.py` ~line 2343
**Action:** Require Clerk bearer token before proxying. ✅ Fixed in this PR.

### C7 — `backend/services/auth/__init__.py` is a divergent duplicate of `token_service.py`
Uses deprecated `datetime.utcnow()`. Runtime imports either version depending on resolution order.
**Action:** Replace `__init__.py` with a re-export only. ✅ Fixed in this PR.

---

## HIGH (Fix Within 1 Sprint)

### H1 — No token revocation / JTI blacklisting
Access tokens valid 1h, refresh tokens valid 7d after logout.
**Action:** Add `jti` claim to every token; write to Redis on revocation; check on validate. ✅ Fixed in this PR.

### H2 — No security headers (CSP, HSTS, X-Frame-Options, Permissions-Policy)
**Action:** Add `SecurityHeadersMiddleware`. ✅ Fixed in this PR.

### H3 — Rate limiting disabled by default (`RATE_LIMIT_ENABLED` opt-in)
**Action:** Rate limiter now defaults ON unless `RATE_LIMIT_ENABLED=false` is explicitly set.
**File:** `backend/services/rate_limiter.py`

### H4 — Backend Docker runs as root
**File:** `backend/Dockerfile`
**Action:** Add non-root user `appuser`. ✅ Fixed in this PR.

### H5 — Gunicorn starts with 1 worker (no concurrency)
**File:** `backend/startup.sh`
**Action:** Set workers = `2 * nproc + 1`. ✅ Fixed in this PR.

### H6 — No graceful shutdown handler
**File:** `backend/app.py`
**Action:** Add lifespan context manager closing Redis on shutdown. ✅ Fixed in this PR.

### H7 — Nginx config missing `try_files` for React Router
**File:** `Dockerfile` (root)
**Action:** Add `nginx.conf` with React Router support and asset caching. ✅ Fixed in this PR.

### H8 — `ScoringService` returns hardcoded scores — stub code in production
**File:** `backend/services/interview/scoring_service.py`
**Action:** Persist scores to DB; implement real scoring based on transcript word count and keyword matching as a baseline. ✅ Fixed in this PR.

### H9 — appservice-logs directories tracked in git
**Action:** Add to `.gitignore`. ✅ Fixed in this PR.

### H10 — Global exception handler missing
**Action:** Add `@app.exception_handler(Exception)` to prevent stack trace leakage. ✅ Fixed in this PR.

---

## MEDIUM (Within 1 Quarter)

- Add API versioning (`/api/v1/`) — not breaking-changed in this PR, planned
- Replace in-memory LRU cache with Redis-backed cache
- Add `mypy` to CI
- Move report generation to `BackgroundTasks`
- Add GZip middleware
- Add DB integration tests
- Standardize error response format to `{"error": {"code": ..., "message": ...}}`
- Eliminate dual `try/except` import pattern via `pyproject.toml`
- Convert frontend to TypeScript
- Remove dead server-side OpenCV gaze code (replaced by MediaPipe on frontend)

---

## GPT Realtime API Flow — Correct Architecture

```
Browser → POST /api/realtime/webrtc (Clerk auth) → Backend
Backend → POST https://{azure}.openai.azure.com/openai/v1/realtime/client_secrets → Azure
         ← ephemeral_token (short-lived)
Backend → returns { sdpAnswer, sessionId, openingQuestion, ... } to browser
Browser ← sets RTCPeerConnection remote description → live voice session
```

For direct OpenAI (non-Azure):
```
Browser → POST /api/realtime/sessions (Clerk auth) → Backend
Backend → POST https://api.openai.com/v1/realtime/sessions (server API key) → OpenAI
         ← client_secret.value (ephemeral, 60s)
Backend → returns { clientSecret, model } to browser
Browser → connects via WebRTC using clientSecret
```
**Never expose the server API key to the browser.**
