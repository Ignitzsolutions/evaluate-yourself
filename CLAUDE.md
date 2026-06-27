# CLAUDE.md

Repository context for Claude-driven work.

## What this project is

Evaluate Yourself is an interview-evaluation platform with:

- a React frontend for candidate/interviewer flows and analytics views
- a FastAPI backend for session management, scoring pipeline, feedback generation, and realtime orchestration

## Stack at a glance

- **Frontend**: React 18, Material UI, Recharts, Playwright
- **Backend**: FastAPI, Python services/modules under `backend/`
- **Runtime glue**: shell scripts at repo root (`start-*.sh`, `deploy.sh`)

## Canonical docs locations

- `README.md` - entry point and local run summary
- `docs/guides/` - setup, quickstarts, websocket guidance, cursor instructions
- `docs/architecture/` and `docs/diagrams/` - architecture artifacts
- `docs/archive/` - historical notes/reports

## Guardrails for changes

- Keep sensitive credentials in environment variables only.
- Do not add redundant frameworks where existing runtime paths already solve the problem.
- Preserve API contract compatibility unless explicitly planning a breaking change.
- When moving files, update all inbound links and docs references in the same change.

## Suggested workflow

1. Read `README.md` and relevant file(s) in `docs/guides/`.
2. Validate affected backend/frontend scripts in `package.json`.
3. Make smallest coherent change that solves the issue.
4. Update docs references if behavior, paths, or setup changed.
