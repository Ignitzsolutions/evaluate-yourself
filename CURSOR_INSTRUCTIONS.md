# 📌 Cursor Instructions — Required Installs & Non-Installs

## ❗ Important Principle (read first)

**Azure OpenAI Realtime via WebRTC requires NO special SDKs for audio, TTS, or WebRTC.**
Everything uses **native browser APIs + standard HTTP**.

If Cursor tries to add audio libraries or WebSocket SDKs, **that is a mistake**.

---

## 1️⃣ Frontend (React) — What to Install

### ✅ Required

```bash
npm install
```

That's it, assuming you already have:

* `react`
* `react-router-dom`
* your UI library (MUI)

### 📌 Uses **native browser APIs**

Cursor must rely on:

* `RTCPeerConnection`
* `navigator.mediaDevices.getUserMedia`
* `<audio>` element for playback
* WebRTC DataChannel

🚫 **Do NOT install**

```bash
npm install socket.io
npm install ws
npm install simple-peer
npm install recordrtc
npm install web-audio-api
npm install audio-worklet*
npm install pcm*
npm install ffmpeg*
```

These are **explicitly forbidden** in this architecture.

---

## 2️⃣ Backend — Python (FastAPI) Option

### ✅ Required

```bash
pip install fastapi uvicorn httpx python-dotenv
```

#### Why each is needed

* `fastapi` → API server
* `uvicorn` → ASGI server
* `httpx` → async HTTP calls to Azure OpenAI
* `python-dotenv` → load `.env` variables

🚫 **Do NOT install**

```bash
pip install websockets
pip install websocket-client
pip install pyaudio
pip install sounddevice
pip install speech*
```

No WebSocket servers, no audio libs.

---

## 3️⃣ Backend — Node.js Option (if using Node instead)

### ✅ Required

```bash
npm install express cors node-fetch dotenv
```

(If Node ≥18, `fetch` is built-in and `node-fetch` is optional.)

🚫 **Do NOT install**

```bash
npm install ws
npm install socket.io
npm install mediasoup
npm install wrtc
```

Backend does **not** handle media — browser does.

---

## 4️⃣ System Tools (Local Machine)

### ✅ Required

```bash
brew install jq
```

Used only for:

* validating Azure OpenAI Realtime endpoints
* debugging curl responses

Optional but useful:

```bash
npm install -g wscat
```

Used **only for diagnostics**, not in production code.

---

## 5️⃣ Environment Variables (Backend)

Cursor must ensure these exist:

```env
AZURE_OPENAI_ENDPOINT=https://ignit-mk7zvb02-swedencentral.cognitiveservices.azure.com
AZURE_OPENAI_DEPLOYMENT=gpt-realtime
AZURE_OPENAI_API_VERSION=2025-08-28
AZURE_OPENAI_API_KEY=********
```

⚠️ Cursor must **never** expose `AZURE_OPENAI_API_KEY` to frontend code.

---

## 6️⃣ Azure OpenAI Realtime — What Cursor Must Call

### ✅ Backend must implement ONLY these endpoints

```http
POST /openai/v1/realtime/client_secrets?api-version=2025-08-28
POST /openai/v1/realtime/calls?api-version=2025-08-28
```

### ❌ Cursor must NOT implement

* WebSocket servers
* Audio encoding/decoding
* Base64 audio handling
* TTS engines
* Speech SDKs

---

## 7️⃣ Frontend Hook Expectations (`useRealtimeInterview`)

Cursor must:

* create `RTCPeerConnection`
* attach mic audio tracks
* handle remote audio tracks
* create one DataChannel (`oai-events`)
* send JSON events only:

  * `session.update`
  * `conversation.item.create`
  * `response.create`

Cursor must NOT:

* send audio manually
* encode PCM16
* manage AudioContext buffers
* use WebSocket connections

---

## 8️⃣ Explicit "Do Not Add" List (Very Important)

Tell Cursor this verbatim:

> ❌ Do NOT add any WebSocket libraries, audio processing libraries, TTS libraries, speech SDKs, or third-party WebRTC wrappers.
> ❌ Do NOT reintroduce PCM16, AudioWorklet, ScriptProcessorNode, or base64 audio.
> ❌ Do NOT use Foundry Project endpoints in the application code.

---

## 9️⃣ One-Line Summary for Cursor (Copy-Paste)

> "This project uses Azure OpenAI Realtime via **native WebRTC**. No WebSocket servers, no audio libraries, no TTS, no PCM conversion. Only install FastAPI/Express for backend HTTP calls and rely on browser WebRTC APIs on the frontend."
