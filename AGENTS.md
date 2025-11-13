# Repository Guidelines

## Project Structure & Module Organization
- `src/` hosts the React SPA. Keep shared UI in `components/`, route-level logic in `pages/`, cross-cutting state under `context/`, hooks in `hooks/`, and visual constants in `styles/` and `theme/`.
- `backend/` contains the FastAPI service (`app.py`) plus a pared-down prototype (`simple_app.py`); mirror new services and tests here.
- `public/` stores static assets delivered by Create React App, while `build/` holds generated bundles—never edit either by hand.
- `docs/`, `models/`, and environment samples capture reference material; update these whenever APIs, prompts, or agent flows change.

## Build, Test, and Development Commands
- Install and run the web client: `npm install`, then `npm start` for hot reloading, `npm run build` for production bundles.
- Front-end tests use Jest via CRA: run `npm test -- --watchAll=false` for a deterministic CI pass.
- Backend setup: `python -m venv .venv && .\\.venv\\Scripts\\activate`, `pip install -r backend/requirements.txt`, then `uvicorn backend.app:app --reload`.
- Full-stack preview lives in `docker-compose.yml`; use `docker compose up --build` after refreshing environment files.

## Coding Style & Naming Conventions
- Follow CRA defaults: 2-space indentation, double quotes, trailing semicolons. Run `npm test` or `npx eslint src --max-warnings=0` before pushing.
- Name React components and files in PascalCase (`InterviewHUD.jsx`), hooks with `use` prefixes, and utility modules in lowerCamelCase.
- Python modules stay snake_case with 4-space indents; surface FastAPI routes via typed Pydantic models and keep side effects inside `if __name__ == "__main__":`.

## Testing Guidelines
- Co-locate React specs as `ComponentName.test.jsx` near the component or under `src/__tests__/`; prefer React Testing Library and mock network calls.
- Introduce backend tests under `backend/tests/` as `test_*.py`, using `pytest` plus FastAPI’s `TestClient`. Add the tooling to `backend/requirements.txt` when committed.
- Aim for coverage on routing, agent state transitions, and critical hooks; document significant gaps in the pull request.

## Commit & Pull Request Guidelines
- Follow the Conventional Commits pattern seen in history (`feat:`, `docs:`, etc.) with imperative, 72-character subject lines and focused changesets.
- Squash noisy WIP commits locally. Reference issue IDs in the body and note affected packages (`frontend`, `backend`) when mixed.
- PRs need: concise summary, testing evidence (command output or screenshots for UI work), updated docs when behavior changes, and confirmation that secrets remain out of version control.

## Environment & Configuration
- Duplicate `.env.example` or `.env.local` files for new keys; never commit real credentials. `OPENAI_API_KEY` and speech service tokens must be sourced from your local shell.
- Keep run scripts (`run_server.sh`, `.bat`) aligned with backend entry points when ports or hosts change, and mirror updates across Docker definitions.
