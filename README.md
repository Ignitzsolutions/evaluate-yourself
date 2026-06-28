

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
python3 -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r backend/requirements.txt
cd backend
uvicorn app:app --host 0.0.0.0 --port 8000 --reload
```

Open http://localhost:3000 in your browser. If port 3000 is occupied, the dev server will prompt to use another port.

### Demo mode (run with no API keys)

You can boot the entire app — admin dashboard, communication-practice scoring, and a simulated voice mic — without any real OpenAI / realtime keys:

```bash
# 1. Copy the example env (placeholder key triggers demo mode automatically)
cp backend/.env.example backend/.env
# 2. (optional) Seed the admin dashboard with realistic data
python backend/scripts/seed_admin_demo_data.py --wipe
# 3. Start backend + frontend
(cd backend && uvicorn app:app --host 127.0.0.1 --port 8088 --reload) &
REACT_APP_API_URL=http://127.0.0.1:8088 npm start
```

When `OPENAI_API_KEY` is empty or a placeholder, a "Demo mode" banner appears, the LLM provider returns deterministic canned responses, and `/api/realtime/sessions` returns a friendly stub instead of erroring. Set a real key to switch back to live behavior — no other config change required.

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
