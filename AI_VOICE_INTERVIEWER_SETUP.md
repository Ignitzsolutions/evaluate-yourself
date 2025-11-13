# 🎤 AI Voice Interviewer Setup Guide

Complete setup instructions for the interactive AI voice interviewer system with LangGraph backend orchestration.

## 🏗️ Architecture Overview

- **Frontend**: React with Material-UI for voice capture, real-time transcription display, and TTS playback
- **Backend**: FastAPI with LangGraph agent orchestration (InterviewAgent + EvaluatorAgent + Coordinator)
- **STT**: OpenAI Whisper (local) or cloud APIs
- **TTS**: Browser speechSynthesis or OpenAI TTS API
- **Orchestration**: LangGraph state machine for conversation flow

## 📋 Prerequisites

- **Node.js** 18+ and npm
- **Python** 3.9+ and pip
- **Docker** and docker-compose (optional but recommended)
- **OpenAI API key** (for TTS and potential GPT integration)

## 🚀 Quick Start with Docker

1. **Clone and setup environment:**
```bash
cd evaluate-yourself
cp backend/.env.example backend/.env
# Edit backend/.env and add your OPENAI_API_KEY
```

2. **Build and run everything:**
```bash
docker-compose up --build
```

3. **Access the application:**
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs

## 🔧 Manual Setup (Development)

### Backend Setup

1. **Navigate to backend directory:**
```bash
cd backend
```

2. **Create virtual environment:**
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. **Install dependencies:**
```bash
pip install -r requirements.txt
```

4. **Setup environment variables:**
```bash
cp .env.example .env
# Edit .env and add your OPENAI_API_KEY
```

5. **Run the backend server:**
```bash
python app.py
# Or with uvicorn: uvicorn app:app --reload
```

### Frontend Setup

1. **Install dependencies:**
```bash
npm install
```

2. **Start development server:**
```bash
npm start
```

## 🎯 How to Use

### 1. Start Voice Interview

Navigate to `/voice-interview/:type` where type is:
- `technical` - Programming and technical questions
- `behavioral` - Soft skills and experience questions  
- `mixed` - Combination of both types

### 2. Voice Interaction Flow

1. **AI asks question** → automatic TTS playback
2. **Click "Start Speaking"** → begin recording your response
3. **Click "Stop Recording"** → audio sent for transcription and evaluation
4. **AI processes and responds** → automatic progression to next question
5. **Repeat until all questions completed**
6. **Automatic redirect to report** → comprehensive analysis

### 3. View Results

- Navigate to `/voice-report/:sessionId` 
- View detailed scores: clarity, confidence, relevance
- Download or print report

## 🔧 API Endpoints

### POST `/api/start-interview`
Start new interview session
```json
{
  "interview_type": "technical"
}
```

### POST `/api/transcribe` 
Process audio and advance conversation
```json
{
  "audio_data": "base64-encoded-audio",
  "session_id": "uuid"
}
```

### GET `/api/session/{session_id}`
Retrieve session data and final report

### GET `/api/tts/{text}`
Generate speech audio from text

## 🤖 LangGraph Agent Architecture

### State Definition
```python
class InterviewState(TypedDict):
    session_id: str
    interview_type: str
    current_question_index: int
    questions: List[str]
    conversation_history: List[Dict]
    candidate_response: str
    ai_response: str
    scores: Dict
    is_complete: bool
```

### Agent Flow
```
InterviewAgent → EvaluatorAgent → Coordinator
     ↑                                 ↓
     ←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←
```

1. **InterviewAgent**: Asks questions, provides conversational responses
2. **EvaluatorAgent**: Scores responses (clarity, confidence, relevance)
3. **Coordinator**: Manages progression, increments question index

## 📊 Session Data Format

```json
{
  "sessionId": "uuid-v4",
  "type": "technical", 
  "durationSeconds": 1200,
  "questions": [
    {
      "index": 0,
      "question": "Explain event loop in JS",
      "response": "candidate answer here",
      "clarity": 85,
      "confidence": 78, 
      "relevance": 92,
      "timestamp": "2025-09-20T12:34:56Z"
    }
  ],
  "aggregate": {
    "avg_clarity": 82,
    "avg_confidence": 79,
    "avg_relevance": 88,
    "overall_score": 83
  },
  "conversation_history": [...],
  "isComplete": true
}
```

## 🔊 Audio Configuration

### Browser Support
- **WebRTC MediaRecorder**: Chrome, Firefox, Safari
- **Web Speech API**: Chrome (best), Firefox (limited)
- **Audio format**: WebM with Opus codec preferred

### Microphone Settings
```javascript
{
  audio: { 
    sampleRate: 16000,
    channelCount: 1,
    echoCancellation: true,
    noiseSuppression: true
  }
}
```

## 🛠️ Customization

### Add New Question Types
Edit `QUESTIONS` dictionary in `backend/app.py`:
```python
QUESTIONS = {
    "technical": [...],
    "behavioral": [...], 
    "custom": [
        "Your custom questions here"
    ]
}
```

### Modify Scoring Logic
Update `evaluator_agent()` function in `backend/app.py` to implement custom scoring algorithms.

### Change TTS Voice
Modify voice settings in `VoiceInterviewPage.jsx`:
```javascript
const utterance = new SpeechSynthesisUtterance(text);
utterance.voice = speechSynthesis.getVoices()[0]; // Select specific voice
utterance.rate = 0.9;
utterance.pitch = 1;
```

## 🐛 Troubleshooting

### Common Issues

**Microphone not working:**
- Check browser permissions
- Ensure HTTPS in production
- Test with `navigator.mediaDevices.getUserMedia()`

**TTS not playing:**
- Check if speechSynthesis is supported
- Verify audio permissions
- Test OpenAI TTS fallback

**Backend connection failed:**
- Verify backend is running on port 8000
- Check CORS settings
- Ensure API_BASE URL is correct

**Docker issues:**
- Ensure ports 3000 and 8000 are available
- Check .env file exists and has OPENAI_API_KEY
- Run `docker-compose logs` for debugging

### Debug Mode
Set environment variables for verbose logging:
```bash
export DEBUG=1
export LOG_LEVEL=debug
```

## 📈 Production Deployment

### Environment Variables
```bash
OPENAI_API_KEY=your-production-key
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
CORS_ORIGINS=https://yourdomain.com
```

### Security Considerations
- Use HTTPS for microphone access
- Implement rate limiting
- Add authentication middleware
- Sanitize audio uploads
- Set up CORS properly

### Performance Optimization
- Use Redis for session caching
- Implement audio compression
- Add CDN for static assets
- Use streaming for large audio files

## 🧪 Testing

### Run Backend Tests
```bash
cd backend
pytest tests/
```

### Run Frontend Tests  
```bash
npm test
```

### Manual Testing Checklist
- [ ] Microphone permission granted
- [ ] Audio recording works
- [ ] Transcription is accurate
- [ ] TTS playback functions
- [ ] Question progression works
- [ ] Report generation succeeds
- [ ] Session persistence works

## 📚 Additional Resources

- [LangGraph Documentation](https://langchain-ai.github.io/langgraph/)
- [OpenAI API Reference](https://platform.openai.com/docs)
- [Web Speech API Guide](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)

## 🤝 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/voice-improvements`
3. Make changes and test thoroughly
4. Submit pull request with detailed description

## 📄 License

MIT License - see LICENSE file for details.