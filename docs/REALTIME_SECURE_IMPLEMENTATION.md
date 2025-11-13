# Azure OpenAI Realtime API - Secure Implementation Summary

## Changes Made

### 1. Frontend (`src/pages/AiInterview.jsx`)
**✅ COMPLETED**
- **Removed hardcoded API key** from the WebSocket URL
- **Switched to project endpoint**: `wss://gpt-interactive-talk.services.ai.azure.com/openai/realtime?deployment=gpt-4o-mini-realtime&api-version=2025-04-01-preview`
- **Implemented Bearer (AAD) authentication**:
  - Fetches token from backend `/api/token` endpoint
  - Sends `authorization` event after WebSocket opens
- **Switched from MediaRecorder (webm/opus) to AudioWorklet (PCM16)**:
  - Captures audio at 48kHz, downsamples to 16kHz
  - Converts float32 to int16 (PCM16)
  - Streams base64-encoded PCM16 chunks to Azure
- **Configured session** for PCM16 input/output with server VAD
- **Plays streamed PCM16 audio** from the server using Web Audio API

### 2. AudioWorklet Processor (`public/pcm-worklet.js`)
**✅ COMPLETED**
- Captures microphone audio at device sample rate (e.g., 48kHz)
- Downsamples to 16kHz using simple decimation
- Converts float32 samples to int16
- Sends ~250ms chunks (4000 samples @ 16kHz) to the main thread

### 3. Backend (`backend/app.py`)
**✅ COMPLETED**
- **Updated `AZURE_REALTIME_SCOPE`** to `https://ai.azure.com/.default`
- **Existing `/api/token` endpoint** uses `DefaultAzureCredential` to fetch Azure AD tokens
- Returns short-lived bearer token for frontend to authenticate with Azure OpenAI

---

## Security Improvements

### ❌ OLD (Insecure):
```
wss://...cognitiveservices.azure.com/...&api-key=EXPOSED_KEY_IN_BROWSER
```
- API key hardcoded in client-side code
- API key visible in browser DevTools, network logs, and source code
- API key can be stolen and reused indefinitely
- **LEAKED KEY MUST BE ROTATED**

### ✅ NEW (Secure):
```
wss://gpt-interactive-talk.services.ai.azure.com/...
Authorization: Bearer <short-lived AAD token>
```
- No secrets in client-side code
- Backend fetches token using `DefaultAzureCredential` (Azure AD)
- Token sent via WebSocket authorization event
- Token expires automatically (short-lived)
- Follows Azure best practices for project endpoints

---

## Audio Format Fix

### ❌ OLD (Incorrect):
```javascript
new MediaRecorder(stream, { mimeType: "audio/webm" })
// Sends webm/opus to Azure (NOT SUPPORTED by Realtime API)
```

### ✅ NEW (Correct):
```javascript
AudioWorkletNode → Downsample → Convert to Int16 → Base64 → WebSocket
// Sends PCM16 @ 16kHz (REQUIRED by Realtime API)
```

---

## Next Steps

### 🔴 CRITICAL: Rotate the Leaked API Key
1. Go to [Azure Portal](https://portal.azure.com)
2. Open your resource: `haris-mgtwk8d0-eastus2.cognitiveservices.azure.com`
3. Navigate to **Keys and Endpoint** blade
4. Click **Regenerate Key 1** or **Regenerate Key 2**
5. **Do NOT commit the new key to your repo**

### 🟡 REQUIRED: Set Up Azure CLI & Login
```powershell
# Install Azure CLI (if not already installed)
# Download from: https://aka.ms/installazurecliwindows

# After installation, authenticate
az login

# Verify your subscription
az account show
```

### 🟢 TEST: Start the Backend
```powershell
# From project root
cd backend
python -m uvicorn app:app --reload --port 8000
```

### 🟢 TEST: Start the Frontend
```powershell
# From project root
npm start
```

### 🟢 TEST: Verify the Interview
1. Navigate to the AI Interview page in your app
2. Click "🎤 Start Interview"
3. Allow microphone access when prompted
4. Verify:
   - WebSocket connects successfully
   - Azure responds with audio + text
   - Transcript appears in the UI
   - No authentication errors in browser console

---

## Troubleshooting

### "Failed to get token: 401"
- Run `az login` to authenticate with Azure
- Ensure your Azure account has access to the project endpoint
- Check `backend/app.py` for correct `AZURE_REALTIME_SCOPE`

### "WebSocket error" or "Connection closed"
- Verify project endpoint URL is correct
- Check deployment name: `gpt-4o-mini-realtime`
- Ensure API version: `2025-04-01-preview`
- Check Azure Portal for deployment status

### "Microphone access denied"
- Grant microphone permissions in browser
- Check browser console for detailed error
- Verify HTTPS (required for `getUserMedia`)

### No audio playback
- Check browser console for PCM16 playback errors
- Verify `playPcm16` function is decoding correctly
- Ensure server is sending `response.audio.delta` events

---

## Files Changed

1. `src/pages/AiInterview.jsx` - Complete rewrite with Bearer auth and PCM16
2. `public/pcm-worklet.js` - New AudioWorklet processor
3. `backend/app.py` - Updated `AZURE_REALTIME_SCOPE`

---

## Backup Files

- `src/pages/AiInterview.jsx.backup` - Old version with hardcoded API key

---

## Commit Message Template

```
feat: secure Azure OpenAI Realtime with Bearer auth and PCM16

- Remove hardcoded API key from frontend
- Switch to project endpoint with AAD authentication
- Implement AudioWorklet for PCM16 audio streaming
- Update backend token scope to https://ai.azure.com/.default
- Add pcm-worklet.js for proper audio format conversion

BREAKING CHANGE: Requires Azure CLI authentication (az login)
```

---

## References

- [Azure OpenAI Realtime API Documentation](https://learn.microsoft.com/en-us/azure/ai-services/openai/realtime-audio-quickstart)
- [DefaultAzureCredential](https://learn.microsoft.com/en-us/python/api/azure-identity/azure.identity.defaultazurecredential)
- [Web Audio API AudioWorklet](https://developer.mozilla.org/en-US/docs/Web/API/AudioWorklet)
