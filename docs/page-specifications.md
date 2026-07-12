# Page Specifications

## `/interviews`

- User objective: choose what type of practice to start.
- Entry point: dashboard, navbar, or post-onboarding next step.
- Primary action: continue with selected interview type.
- Secondary action: return to dashboard.
- Required content: page title, brief explanation, selectable interview types, duration, difficulty.
- Loading state: not required; page is static.
- Empty state: not required; interview types are static.
- Error state: not required unless routing fails.
- Mobile behavior: cards stack; primary action remains reachable near the top.

## `/interview-config`

- User objective: configure a valid interview setup.
- Entry point: `/interviews`.
- Primary action: start Sonia.
- Secondary action: cancel back to interviews.
- Required content: role, difficulty, interview type, consent, skills for technical/mixed sessions.
- Loading state: show stream-catalog loading only when needed.
- Empty state: if skill catalog is unavailable, show retry instead of empty controls.
- Error state: inline recovery for setup/start failures.
- Mobile behavior: form fields stack; actions stay clear and full-width where needed.

## `/interview/session/:sessionId`

- User objective: complete the live Sonia interview.
- Primary action: continue speaking and end session when ready.
- Required content: connection state, Sonia speaking, listening, recovery state, transcript, controls.
- Error state: reconnect or return to setup with context.

## `/report/:sessionId`

- User objective: understand feedback and next steps.
- Primary action: review report or return to interviews.
- Error state: distinguish not found, auth, backend unavailable, and generic failure.

