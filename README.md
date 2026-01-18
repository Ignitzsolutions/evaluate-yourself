

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

> **📌 For Cursor AI**: See [CURSOR_INSTRUCTIONS.md](CURSOR_INSTRUCTIONS.md) for detailed installation requirements and forbidden packages list.

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

### Azure Configuration (Required for Voice Interview)

The voice-only interview feature requires Azure OpenAI Realtime API configuration:

1. **Create Azure OpenAI resource** in Azure Portal
2. **Deploy `gpt-4o-realtime` model**
3. **Get API key and endpoint** from Azure Portal
4. **Configure `backend/.env`** file:
   ```env
   AZURE_OPENAI_API_KEY=your-api-key
   AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com
   AZURE_OPENAI_DEPLOYMENT=gpt-4o-realtime
   ```

See [SETUP.md](SETUP.md) for detailed configuration instructions.


---

## License

This project is released under the terms of the MIT License. See `LICENSE` for details.

