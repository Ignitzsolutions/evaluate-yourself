z

<p align="center">
	<img src="public/assets/logo.png" alt="Evaluate Yourself Logo" width="220" />
</p>

An elegant pre-interview evaluation web app that measures and analyzes interpersonal and presentation skills. The project focuses on a clean UI, modern typography (Inter), and a professional, card-based design system using Material UI.

---

## Features

- Clean, professional UI with Inter (geometric sans-serif) typography
- Card-based layout for clear metrics and charts
- Material-UI icons and components for consistent styling
- Real-time interview experience with webcam and text-to-speech for questions
- Detailed post-interview analytics (eye contact, speaking time, confidence)
- Rating and feedback collection

---


![Landing Screenshot](public/assets/skillevaluation.png)

---


## Local development

> **📌 For Cursor AI**: See [docs/guides/CURSOR_INSTRUCTIONS.md](docs/guides/CURSOR_INSTRUCTIONS.md) for detailed installation requirements and forbidden packages list.

### Quick Start

**Frontend:**
```bash
npm install
npm start
```

**Backend:**
```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
uv sync
cd backend
uv run uvicorn app:app --host 0.0.0.0 --port 8000 --reload
```

Open http://localhost:3000 in your browser. If port 3000 is occupied, the dev server will prompt to use another port.

### Python tooling

The backend Python source of truth is now:

- `pyproject.toml`
- `uv.lock`

Common commands:

```bash
uv sync
uv run black --check backend/services/auth backend/services/interview/scoring_service.py backend/scripts
uv run mypy
uv run pytest backend/tests
```

`requirements.txt` remains in the repo only as an Azure/Oryx compatibility export during the transition.

### LLM Configuration (Required for Voice Interview)

The voice-only interview feature requires an LLM realtime configuration.

1. Copy `backend/.env.example` to `backend/.env`
2. Configure your provider credentials in `backend/.env`
3. Start the backend and verify `/health` returns success

See [docs/guides/SETUP.md](docs/guides/SETUP.md) for detailed configuration instructions.

### Documentation

Root-level legacy setup notes were moved into [`docs/guides/`](docs/guides/README.md) to keep the repository root focused on code and runtime configuration.


---

## License

This project is released under the terms of the MIT License. See `LICENSE` for details.
## Database Entity Relationship Diagram (ERD)

The following diagram shows the database design of the AI Self-Evaluation Platform.

![ER Diagram](docs/images/erd-diagram.png)