# AI Interview Application - Complete Setup & Testing Guide

## ✅ Current Status

- **Backend**: Running on http://127.0.0.1:8000 ✅
- **Frontend**: Running on http://localhost:3000 ✅
- **Routes**: Unified and correct ✅
- **Azure Authentication**: Ready (requires `az login`) ⏳

---

## 🚀 Quick Start

### Step 1: Install Azure CLI & Authenticate
```powershell
# Download from: https://aka.ms/installazurecliwindows
# OR if using Chocolatey:
choco install azure-cli

# Then authenticate:
az login
```

### Step 2: Verify Backend is Running
```powershell
# In one terminal (from project root):
python -m uvicorn backend.app:app --reload --port 8000

# Should show:
# INFO:     Uvicorn running on http://127.0.0.1:8000
```

### Step 3: Verify Frontend is Running
```powershell
# In another terminal (from project root):
npm start

# Should open browser at http://localhost:3000
```

### Step 4: Test the Application Flow

1. **Go to Landing Page** → http://localhost:3000
2. **Click "Get Started"** → Login page
3. **Login** (demo credentials or test account)
4. **Dashboard** → See "AI Interview" button
5. **Click AI Interview** → Select interview type
6. **Start Interview** → Microphone access required

---

## 🔐 Azure Configuration

### Prerequisites
- Azure OpenAI resource with Realtime API deployed
- Deployment name: `gpt-4o-mini-realtime`
- Resource region: `eastus2` (or your region)

### Backend Token Endpoint

The backend provides a secure token endpoint:

```
GET /api/token
```

**Response:**
```json
{
  "token": "eyJhbGc...",
  "expires_on": 1729286400,
  "scope": "https://ai.azure.com/.default"
}
```

**Frontend Usage:**
```javascript
const res = await fetch("/api/token", { cache: "no-store" });
const { token } = await res.json();
// Send token as bearer auth in WebSocket
ws.send(JSON.stringify({
  type: "authorization",
  authorization: { type: "bearer", token }
}));
```

---

## 📋 Routes Summary

### Frontend Routes
| Route | Component | Access | Description |
|-------|-----------|--------|-------------|
| `/` | LandingPage | Public | Landing page with intro |
| `/login` | LoginPage | Public | Authentication |
| `/dashboard` | Dashboard | Protected | Main dashboard |
| `/interview/ai` | AiInterview | Protected | AI interview experience |
| `/resume` | ResumePage | Protected | Resume upload |
| `/test` | TestPage | Public | Test/debug page |

### Backend Routes
| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/` | Health check |
| GET | `/health` | Health status |
| GET | `/api/token` | Issue Azure AD token |

---

## 🎤 Interview Flow

### 1. User Starts Interview
- Selects interview type (Technical/Behavioral/Mixed)
- Frontend fetches token from `/api/token`
- Navigates to `/interview/ai` with state: `{ interviewType }`

### 2. Interview Component Initializes
- User clicks "🎤 Start Interview"
- Requests microphone access
- Fetches Azure token
- Establishes WebSocket connection to Azure Realtime API

### 3. WebSocket Connection
```
POST wss://gpt-interactive-talk.services.ai.azure.com/openai/realtime?deployment=gpt-4o-mini-realtime&api-version=2025-04-01-preview
```

### 4. Authorization
Frontend sends:
```json
{
  "type": "authorization",
  "authorization": { "type": "bearer", "token": "..." }
}
```

### 5. Session Configuration
Frontend sends:
```json
{
  "type": "session.update",
  "session": {
    "input_audio_format": { "type": "pcm16", "sample_rate_hz": 16000 },
    "output_audio_format": { "type": "pcm16", "sample_rate_hz": 16000 },
    "server_vad": { "type": "default" },
    "instructions": "You are a friendly interviewer..."
  }
}
```

### 6. Audio Streaming
- AudioWorklet captures microphone at 48kHz
- Downsamples to 16kHz PCM16
- Sends base64-encoded chunks via WebSocket
- Receives audio + text from Azure
- Plays audio via Web Audio API

### 7. Transcript Display
- User's speech converted to text (via audio delta)
- Model's responses streamed in real-time
- Transcript accumulated in UI

---

## 🧪 Testing Checklist

### Local Development
- [ ] Backend starts without errors: `python -m uvicorn backend.app:app --reload --port 8000`
- [ ] Frontend starts without errors: `npm start`
- [ ] Landing page loads at http://localhost:3000
- [ ] Login flow works with test account
- [ ] Dashboard displays correctly
- [ ] "Start Interview" button navigates to `/interview/ai`

### Azure Integration
- [ ] `az login` completes successfully
- [ ] `/api/token` returns valid token: `curl http://127.0.0.1:8000/api/token`
- [ ] WebSocket connects to Azure Realtime API
- [ ] Audio streams successfully
- [ ] Interview responses appear in transcript

### Interview Experience
- [ ] Microphone permission granted
- [ ] Audio captures properly
- [ ] Model responds with audio + text
- [ ] Transcript updates in real-time
- [ ] Can stop/end interview cleanly

---

## 🐛 Troubleshooting

### Backend Issues

**Error: `ModuleNotFoundError: No module named 'backend'`**
- Solution: Run from project root, not from `backend/` folder
- Command: `python -m uvicorn backend.app:app --reload --port 8000`

**Error: `CredentialUnavailableError`**
- Solution: Run `az login` in your terminal
- Verify: `az account show`

**Error: Port 8000 already in use**
- Solution: Kill existing process or use different port
- Command: `netstat -ano | findstr :8000`

### Frontend Issues

**Warning: `Unexpected Unicode BOM`**
- Solution: File was saved with BOM encoding
- Command: `Get-Content src/pages/AiInterview.jsx -Encoding UTF8 | Set-Content src/pages/AiInterview.jsx -Encoding UTF8NoBOM`

**Error: `Cannot find module './pages/AiInterview'`**
- Solution: Rebuild frontend
- Command: `npm run build`

### Interview Connection Issues

**Error: `Failed to get token: 401`**
- Cause: Azure AD authentication failed
- Solution: Run `az login` and retry

**Error: `WebSocket connection refused`**
- Cause: Azure endpoint or deployment incorrect
- Solution: Verify deployment name and region in code

**No microphone access**
- Cause: Browser permission not granted or HTTPS required in production
- Solution: Grant permission or use HTTPS

---

## 📁 File Structure

```
evaluate-yourself/
├── backend/
│   └── app.py                    # FastAPI backend with token endpoint
├── public/
│   ├── index.html
│   └── pcm-worklet.js            # AudioWorklet for PCM16 encoding
├── src/
│   ├── App.js                    # Main app with routes
│   ├── pages/
│   │   ├── LandingPage.jsx
│   │   ├── LoginPage.jsx
│   │   ├── Dashboard.jsx         # Main dashboard
│   │   └── AiInterview.jsx       # AI interview with WebSocket
│   ├── components/
│   │   ├── PrivateRoute.jsx      # Route protection
│   │   └── LogoutButton.jsx
│   ├── context/
│   │   └── AuthContext.jsx       # Auth state
│   ├── hooks/
│   │   └── useAuth.js
│   └── styles/
│       └── aiInterview.css
└── package.json
```

---

## 🔑 Key Components

### Backend (`backend/app.py`)
- Minimal FastAPI server
- `/api/token` endpoint for Azure AD tokens
- CORS enabled for localhost:3000/3001
- No LangGraph dependencies (simplified)

### Frontend (`src/pages/AiInterview.jsx`)
- React component with WebSocket management
- AudioWorklet integration for PCM16 audio
- Real-time transcript display
- Bearer token authentication

### AudioWorklet (`public/pcm-worklet.js`)
- Processes microphone audio at device sample rate
- Downsamples to 16kHz
- Converts float32 to int16 (PCM16)
- Sends chunks via message port

---

## 📞 Support

If you encounter issues:

1. Check terminal output for error messages
2. Verify `az login` has been executed
3. Check browser DevTools Console for client errors
4. Verify network connectivity to Azure
5. Confirm all ports (3000, 8000) are available

---

**Last Updated:** October 17, 2025
**Status:** ✅ Ready for Testing
