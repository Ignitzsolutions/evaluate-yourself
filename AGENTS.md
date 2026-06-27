# AGENTS.md

This repository has two major runtimes:

1. **Frontend**: React app (root `src/`) served with `react-scripts`.
2. **Backend**: FastAPI service (under `backend/`) that provides interview APIs, realtime flow integration, and evaluation pipeline services.

## Execution map

- `npm start` -> frontend dev server
- `./start-backend.sh` -> backend startup helper
- `./start-all.sh` -> starts frontend and backend together
- `npm run test:backend` -> backend test suite
- `npm run test:e2e` -> Playwright smoke/e2e

## Important directories

- `backend/api`, `backend/routes` - HTTP surfaces
- `backend/services` - business orchestration
- `backend/db`, `backend/migrations` - persistence and schema evolution
- `tests/` - e2e and integration checks
- `docs/` - architecture, troubleshooting, and archived reports
- `docs/guides/` - setup and operator-facing runbooks

## Realtime constraints

- The project uses Azure/OpenAI realtime flows and browser-native media paths.
- Avoid introducing unnecessary third-party websocket/audio wrappers where native/browser or existing backend abstractions are already used.
- Keep secrets server-side only (`backend/.env`), never exposed to frontend bundles.

## Working conventions

- Prefer minimal, targeted edits.
- Update docs when behavior or setup changes.
- Keep root clean: operational docs belong in `docs/guides/`; historical material belongs in `docs/archive/`.
