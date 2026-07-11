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
| `/checkout/:planKey` | `PublicLayout` | `src/pages/CheckoutPage.jsx` | Redirect-based checkout for plan payment methods |
| `/login/*` | `AuthLayout` | `src/pages/LoginPage.jsx` | User login |
| `/register/*` | `AuthLayout` | `src/pages/RegisterPage.jsx` | User signup |
| `/forgot-password/*` | `AuthLayout` | `src/pages/ForgotPasswordPage.jsx` | Password recovery |
| `/set-password/*` | `AuthLayout` | `src/pages/SetPasswordPage.jsx` | Secure first-time password setup |
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

- `overview`, `live`, `security`, `candidates`, `candidates/:clerkUserId`, `interviews`, `question-bank`, `trials`, `exports`, `config`

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
| Pricing and checkout UX | `src/pages/PricingPage.jsx`, `src/pages/CheckoutPage.jsx`, `src/config/pricingConfig.js` |

## 5) Local AI workflow skills

These are local assistant skills used for repo work. They are not application runtime dependencies and should not be imported by product code.

| Skill | Use in this repo |
|---|---|
| `use-mcp` | Product-code changes that need lean schemas, shared logic, parameterized tests, and premium light-only UI |
| `frontend-skill` | Higher-polish React page and SaaS UI work, especially landing, pricing, checkout, and report surfaces |
| `playwright` | Browser-level verification for routing, viewport fit, and end-to-end candidate flows |
| `gh-fix-ci` | GitHub Actions failure inspection and CI remediation |
| `remotion-best-practices` | Future video/replay overlay work if report playback moves into Remotion-rendered assets |

## 6) Editing rules for this repo

1. Keep route contracts stable unless a breaking change is explicitly requested.
2. When changing a route, update both caller and server side in one change.
3. Keep root clean: guides in `docs/guides/`, historical docs in `docs/archive/`.
4. Never expose secrets to frontend bundles; keep keys server-side only.
5. Keep checkout redirect configuration frontend-safe: use public payment URLs only, never provider secret keys.

## 7) Production application workflow

Before implementing product changes:

1. Restate the user goal.
2. Describe the shortest successful user flow.
3. List all required UI states.
4. Identify reusable components.
5. Identify accessibility, security, and data risks.
6. Ask only for information that blocks implementation.

Implementation rules:

1. Use only the existing design tokens and components.
2. Do not create one-off colors, spacing values, or component variants.
3. Use semantic HTML.
4. Maintain keyboard navigation and visible focus.
5. Use one clear primary action per screen.
6. Do not add decorative gradients, glass effects, excessive cards, or animation.
7. Do not use vague placeholder copy.
8. Preserve user input during failures.
9. Implement empty, loading, partial, success, and error states.
10. Keep the UI responsive at mobile, tablet, and desktop widths.
11. Validate external and AI-generated data before rendering.
12. Require confirmation before consequential AI tool calls.
13. Never expose secrets or perform authorization only in the browser.

After implementation:

1. Run type checking.
2. Run linting.
3. Run component tests.
4. Run end-to-end tests.
5. Run accessibility checks.
6. Check mobile and keyboard behavior.
7. Review loading, empty, and error states.
8. Report any unresolved risks or assumptions.
