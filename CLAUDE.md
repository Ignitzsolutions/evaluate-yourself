# CLAUDE.md

Repository context and route index for Claude-driven work.

## 1) System map (where things are)

| Area | Main location | What it owns |
|---|---|---|
| Frontend app | `src/` | React pages, routing, UI state, interview flows |
| Frontend routes | `src/App.js` | All browser routes and route guards |
| Backend entrypoint | `backend/app.py` | FastAPI app bootstrapping + core API/WebSocket endpoints |
| Modular backend routers | `backend/api/*.py`, `backend/routes/*.py` | Auth, admin, health, realtime router modules |
| Interview domain logic | `backend/services/interview/` | Scoring, orchestration, report pipeline, skill tracks |
| Session + event stream | `backend/services/session/` | Session state, event log, stream replay |
| Auth services | `backend/services/auth/` | Password hashing, token validation, auth middleware |
| Data access | `backend/db/`, `backend/models/` | DB/Redis clients and persistence models |
| Docs | `docs/guides/`, `docs/architecture/`, `docs/archive/` | Setup guides, architecture docs, archived notes |

## 2) Frontend route index (`src/App.js`)

| Route | Guard/layout | Component file | Key functionality |
|---|---|---|---|
| `/` | `LandingLayout` | `src/pages/LandingPage.jsx` | Landing page |
| `/presentation` | `LandingLayout` | `src/pages/PresentationPage.jsx` | Product presentation |
| `/pricing` | `PublicLayout` | `src/pages/PricingPage.jsx` | Pricing view |
| `/test-realtime` | `PublicLayout` | `src/pages/RealtimeTestPage.jsx` | Realtime connection checks |
| `/login/*` | `AuthLayout` | `src/pages/LoginPage.jsx` | User login |
| `/register/*` | `AuthLayout` | `src/pages/RegisterPage.jsx` | User signup |
| `/forgot-password/*` | `AuthLayout` | `src/pages/ForgotPasswordPage.jsx` | Password recovery |
| `/admin` | `AuthLayout` | `src/pages/AdminEntryPage.jsx` | Admin entry routing |
| `/admin/login/*` | `AuthLayout` | `src/pages/AdminLoginPage.jsx` | Admin login |
| `/onboarding` | `PrivateRoute + MainLayout` | `src/pages/OnboardingPage.jsx` | First-time onboarding |
| `/admin/dashboard/*` | `PrivateRoute + AdminRoute + AdminLayout` | `src/pages/admin/*` | Admin dashboard suite |
| `/dashboard` | `PrivateRoute + OnboardingGuard + MainLayout` | `src/pages/Dashboard.jsx` | Candidate dashboard |
| `/analytics` | same as above | `src/pages/AnalyticsPage.jsx` | Candidate analytics |
| `/interviews` | same as above | `src/pages/InterviewsPage.jsx` | Interview list/start |
| `/interview-config` | same as above | `src/pages/PreInterviewForm.jsx` | Interview setup form |
| `/report/:sessionId` | same as above | `src/pages/ReportPage.jsx` | Interview report |
| `/interview/:type` | `PrivateRoute + OnboardingGuard` | `src/pages/InterviewSessionRoom.jsx` | Live interview room |
| `/interview/session/:sessionId` | `PrivateRoute + OnboardingGuard` | `src/pages/InterviewSessionRoom.jsx` | Resume session by ID |
| `*` | none | `src/pages/NotFoundPage.jsx` | Not-found fallback |

Admin subroutes under `/admin/dashboard`:

- `overview`, `candidates`, `candidates/:clerkUserId`, `interviews`, `question-bank`, `trials`, `exports`, `config`

## 3) Backend route index

### 3.1 Router modules mounted from `backend/app.py`

| Prefix | Source file | Key functionality |
|---|---|---|
| `/health` | `backend/routes/health.py` | Health/dependency checks (DB, Redis, OpenAI config) |
| `/api/auth/*` | `backend/api/auth.py` | Register, login, logout, refresh, set-password |
| `/api/admin/*` | `backend/api/admin.py` | Admin analytics, candidate management, trials, exports, question bank |
| `/ws/interview/{session_id}` | `backend/api/realtime.py` | Realtime interview event stream (WELCOME/REPLAY/EVENT protocol) |

### 3.2 Direct endpoints in `backend/app.py` (core)

| Path/prefix | Methods | Key functionality |
|---|---|---|
| `/api/realtime/webrtc`, `/api/realtime/sessions` | POST | Realtime session bootstrap/token flows |
| `/api/realtime/ws`, `/api/interview/realtime/{session_id}` | WebSocket | Realtime interview messaging channels |
| `/api/interview/skill-catalog` | GET | Skill catalog for interview configuration |
| `/api/interview/reports*` | GET/POST/PUT | Report create/list/detail/feedback/download/replay |
| `/api/interview/sessions/{session_id}*` | GET | Session detail + gaze events |
| `/api/interview/{session_id}/next-turn` | POST | Next generated turn |
| `/api/interview/{session_id}/adaptive-turn` | POST | Adaptive follow-up turn |
| `/api/interview/{session_id}/capture` | POST | Capture interview artifacts/events |
| `/api/interview/{session_id}/transcript` | POST | Transcript ingest/persistence |
| `/api/analytics/summary`, `/trends`, `/skills` | GET | Candidate analytics aggregation |
| `/api/self-insight/*` | POST/GET/PATCH | Self-insight assessments and report refinement |
| `/api/profile*`, `/api/me`, `/api/users/me`, `/api/auth/sync` | GET/PUT/POST | User profile and identity sync |
| `/api/trial-codes/redeem`, `/api/waitlist` | POST | Trial code redemption and waitlist |
| `/ws/gaze/{session_id}`, `/ws` | WebSocket | Gaze stream and legacy/general websocket channel |
| `/` and `/{full_path:path}` | GET | SPA/static serving fallback |

### 3.3 Admin API (`backend/api/admin.py`) key groups

- Dashboard metrics: overview, funnel, quality, active users
- Candidate operations: list, detail, deactivate/delete, bulk actions
- Trial management: trial codes, trial activity/reporting
- Interview/report administration: interviews, reports, exports
- Question bank management: tracks, built-in/custom question updates
- System config surfaces: admin-visible runtime/config endpoints

## 4) Key functionality positions (quick pointers)

| Functionality | Primary files |
|---|---|
| Auth + token handling | `backend/api/auth.py`, `backend/services/auth/token_service.py`, `backend/services/auth/password_service.py` |
| Realtime websocket protocol | `backend/api/realtime.py`, `backend/app.py` (additional websocket endpoints) |
| Interview orchestration + scoring | `backend/services/interview/orchestrator.py`, `scoring_service.py`, `report_pipeline.py`, `semantic_scorer.py`, `adaptive_engine.py` |
| Session events + replay | `backend/services/session/session_events.py`, `session_manager.py`, `session_store.py` |
| Gaze capture pipeline | `src/components/WebcamToGaze.js`, `backend/services/gaze_monitor.py`, `backend/app.py` websocket gaze endpoints |
| Admin console frontend | `src/pages/admin/*`, `src/components/AdminRoute.jsx` |
| Candidate report UX | `src/pages/ReportPage.jsx`, `src/pages/AnalyticsPage.jsx`, `src/pages/Dashboard.jsx` |

## 5) Editing rules for this repo

1. Keep route contracts stable unless a breaking change is explicitly requested.
2. When changing a route, update both caller and server side in one change.
3. Keep root clean: guides in `docs/guides/`, historical docs in `docs/archive/`.
4. Never expose secrets to frontend bundles; keep keys server-side only.
