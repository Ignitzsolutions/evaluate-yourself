# Security Best Practices Report

## Executive Summary

The password setup candidate-flow gap is now closed without introducing an email-only account takeover path. The set-password endpoint accepts a short-lived `password_setup` token or an existing authenticated bearer session, and login does not mint setup tokens for passwordless users.

The highest remaining application security risk is session token storage in browser `localStorage`. That is a common SPA shortcut, but it means any future XSS can steal access and refresh tokens. Move auth to HttpOnly cookies with CSRF protection before treating the app as production-hardened.

## Fixed In This Pass

### F-1: Passwordless migrated users could not complete `/set-password/*`

- Severity: High
- Rule ID: FASTAPI-AUTH-001, FASTAPI-AUTH-004
- Location: `/Users/srujanreddy/.codex/worktrees/66c7/evaluate-yourself/backend/api/auth.py:171`
- Evidence: `_require_password_setup_user` now requires either a bearer session or a valid `password_setup` token, and rejects missing/invalid setup tokens.
- Impact: The previous UI was a placeholder while the backend had a real endpoint, creating a dead end for migrated users.
- Fix: Added a scoped token path in `/api/auth/set-password`, a dedicated frontend page, and regression tests.
- Security note: `/api/auth/login` still returns `PASSWORD_NOT_SET` without a setup token at `/Users/srujanreddy/.codex/worktrees/66c7/evaluate-yourself/backend/api/auth.py:287`, preventing email-only account takeover.

### F-2: Checkout redirect accepted any configured URL scheme

- Severity: Medium
- Rule ID: JS-URL-001
- Location: `/Users/srujanreddy/.codex/worktrees/66c7/evaluate-yourself/src/pages/CheckoutPage.jsx:70`
- Evidence: Redirect now validates `url.protocol` is `http:` or `https:` before `window.location.assign`.
- Impact: A bad checkout env value could previously navigate users to an unsafe active scheme.
- Fix: Block non-HTTP(S) checkout URLs and show a visible configuration error.

### F-3: Direct backend execution enabled `uvicorn` reload by default

- Severity: Medium
- Rule ID: FASTAPI-DEPLOY-001
- Location: `/Users/srujanreddy/.codex/worktrees/66c7/evaluate-yourself/backend/app.py:7815`
- Evidence: `reload` is now controlled by `UVICORN_RELOAD` and defaults to off.
- Impact: Auto-reload in production can expose unstable dev behavior and unnecessary file watching.
- Fix: Made reload explicit opt-in.

## Remaining Findings

### S-1: Access and refresh tokens are stored in `localStorage`

- Severity: High
- Rule ID: REACT-CONFIG-001, frontend storage guidance
- Location: `/Users/srujanreddy/.codex/worktrees/66c7/evaluate-yourself/src/context/AuthContext.jsx:29`
- Evidence: `localStorage` stores `access_token` and `refresh_token` at `/Users/srujanreddy/.codex/worktrees/66c7/evaluate-yourself/src/context/AuthContext.jsx:59` and `/Users/srujanreddy/.codex/worktrees/66c7/evaluate-yourself/src/context/AuthContext.jsx:60`.
- Impact: If any XSS lands anywhere in the app, an attacker can read long-lived refresh credentials and persist account access.
- Fix: Move refresh tokens to HttpOnly, Secure, SameSite cookies and keep access tokens in memory only. Add CSRF protection for cookie-authenticated state-changing routes.
- Mitigation: Keep CSP tight, avoid raw HTML sinks, and reduce refresh-token lifetime until the cookie migration is complete.

### S-2: Production CORS allows all methods and all headers

- Severity: Medium
- Rule ID: FASTAPI baseline CORS least privilege
- Location: `/Users/srujanreddy/.codex/worktrees/66c7/evaluate-yourself/backend/app.py:544`
- Evidence: `allow_methods=["*"]` and `allow_headers=["*"]` are configured with credentials enabled.
- Impact: CORS is not authentication, but broad CORS increases browser attack surface if an allowed origin is compromised or misconfigured.
- Fix: In production, restrict methods to the actual API surface (`GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `OPTIONS`) and headers to required values (`Authorization`, `Content-Type`, request IDs).
- False positive notes: Origins are not wildcarded in production, which is good. This is a least-privilege hardening item, not an immediate exploit by itself.

### S-3: WebSocket query-token support leaks credentials into URLs

- Severity: Medium
- Rule ID: FASTAPI-AUTH-002
- Location: `/Users/srujanreddy/.codex/worktrees/66c7/evaluate-yourself/backend/api/realtime.py:131`
- Evidence: WebSocket auth accepts a `token` query parameter when an Authorization header is unavailable.
- Impact: Query tokens can appear in browser history, reverse proxy logs, and telemetry.
- Fix: Prefer a short-lived WebSocket-specific ticket minted immediately before connection, scoped to one session and one upgrade. Keep its lifetime under 60 seconds.
- False positive notes: Browser WebSocket APIs cannot always send custom auth headers, so this may be a practical compromise. The safer version is a one-use ticket, not a normal session token in the URL.

## Verification

- `python3 -m py_compile backend/api/auth.py backend/services/auth/token_service.py backend/app.py`
- `uv run pytest backend/tests/test_auth_set_password.py`
- `CI=true npm test -- --runInBand src/pages/__tests__/AuthPages.test.jsx src/pages/__tests__/CheckoutPage.test.jsx`
