# Setup Guide - Evaluate Yourself

Complete setup instructions for configuring the voice-only responsive interview with Azure services.

> **📌 For Cursor AI**: See [CURSOR_INSTRUCTIONS.md](CURSOR_INSTRUCTIONS.md) for Cursor-specific installation requirements and forbidden packages list.

## Prerequisites

- Node.js (v18+) and npm
- Python 3.11+ with pip
- Azure account with access to:
  - Azure OpenAI service (for Realtime API)
  - Azure Speech Services (optional, for enhanced transcription)

## Quick Start

### 1. Install Dependencies

**Frontend:**
```bash
npm install
```

**Backend:**
```bash
python3 -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
pip install -r backend/requirements.txt
```

### 2. Configure Environment Variables

#### Backend Configuration (`backend/.env`)

Copy the example file and add your Azure credentials:

```bash
cp backend/.env.example backend/.env
```

**Required for Voice Interview:**
- `AZURE_OPENAI_API_KEY` - Your Azure OpenAI API key
- `AZURE_OPENAI_ENDPOINT` - Your Azure OpenAI endpoint (e.g., `https://your-resource.openai.azure.com`)
- `AZURE_OPENAI_DEPLOYMENT` - Deployment name (default: `gpt-4o-realtime`)

**Optional:**
- `AZURE_SPEECH_KEY` - Azure Speech Services key (for enhanced transcription)
- `AZURE_SPEECH_REGION` - Region (e.g., `centralindia`)
- `OPENAI_REALTIME_API_KEY` - Fallback to OpenAI if Azure OpenAI not available

#### Frontend Configuration (`.env` in root)

```bash
cp .env.example .env  # If example exists, or create new
```

**Required:**
- `REACT_APP_API_URL` or `VITE_API_URL` - Backend URL (default: `http://localhost:8000`)

**Optional:**
- `REACT_APP_AZURE_SPEECH_KEY` - For frontend speech recognition features

### 3. Get Azure OpenAI Realtime API Credentials

1. **Create Azure OpenAI Resource:**
   - Go to [Azure Portal](https://portal.azure.com)
   - Create new "Azure OpenAI" resource
   - Select your subscription and resource group
   - Choose region (e.g., `centralindia`, `eastus`, `westus2`)

2. **Deploy Realtime Model:**
   - Navigate to your Azure OpenAI resource
   - Go to "Model deployments" section
   - Click "Create" and deploy `gpt-4o-realtime` model
   - Note the deployment name (usually `gpt-4o-realtime`)

3. **Get API Key and Endpoint:**
   - In Azure OpenAI resource, go to "Keys and Endpoint"
   - Copy one of the API keys
   - Copy the endpoint URL (format: `https://your-resource.openai.azure.com`)

4. **Add to `backend/.env`:**
   ```env
   AZURE_OPENAI_API_KEY=your-copied-api-key
   AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com
   AZURE_OPENAI_DEPLOYMENT=gpt-4o-realtime
   ```

### 4. Get Azure Speech Services Credentials (Optional)

If you have an Azure Speech Services resource (like `projectespeech`):

1. Go to your Speech Services resource in Azure Portal
2. Navigate to "Keys and Endpoint"
3. Copy the API key and endpoint
4. Add to `backend/.env`:
   ```env
   AZURE_SPEECH_KEY=your-speech-service-key
   AZURE_SPEECH_REGION=centralindia
   AZURE_SPEECH_ENDPOINT=https://centralindia.api.cognitive.microsoft.com/
   ```

### 5. Run the Application

**Terminal 1 - Backend:**
```bash
cd backend
source ../.venv/bin/activate
uvicorn app:app --host 0.0.0.0 --port 8000 --reload
```

**Terminal 2 - Frontend:**
```bash
npm start
```

The application will be available at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs

## Environment Variables Reference

### Backend (`backend/.env`)

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `AZURE_OPENAI_API_KEY` | Yes* | Azure OpenAI API key | `abc123...` |
| `AZURE_OPENAI_ENDPOINT` | Yes* | Azure OpenAI endpoint | `https://myresource.openai.azure.com` |
| `AZURE_OPENAI_DEPLOYMENT` | Yes* | Model deployment name | `gpt-4o-realtime` |
| `AZURE_OPENAI_API_VERSION` | No | API version | `2024-10-01-preview` |
| `OPENAI_REALTIME_API_KEY` | Yes* | OpenAI API key (fallback) | `sk-...` |
| `AZURE_SPEECH_KEY` | No | Speech Services key | `abc123...` |
| `AZURE_SPEECH_REGION` | No | Speech Services region | `centralindia` |
| `AZURE_SPEECH_ENDPOINT` | No | Speech Services endpoint | `https://centralindia.api.cognitive.microsoft.com/` |

*Either Azure OpenAI or OpenAI Realtime API key is required.

### Frontend (`.env`)

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `REACT_APP_API_URL` | No | Backend API URL | `http://localhost:8000` |
| `VITE_API_URL` | No | Backend API URL (Vite) | `http://localhost:8000` |
| `REACT_APP_AZURE_SPEECH_KEY` | No | Speech Services key | `abc123...` |
| `REACT_APP_AZURE_SPEECH_REGION` | No | Speech Services region | `centralindia` |

## Troubleshooting

### Backend won't start
- Check that all Python dependencies are installed: `pip install -r backend/requirements.txt`
- Verify `.env` file exists in `backend/` directory
- Check for syntax errors in `.env` file (no spaces around `=`)

### Interview connection fails
- Verify `AZURE_OPENAI_API_KEY` and `AZURE_OPENAI_ENDPOINT` are set correctly
- Check that the deployment name matches your Azure OpenAI deployment
- Ensure the model `gpt-4o-realtime` is deployed in your Azure OpenAI resource
- Check backend logs for specific error messages

### Audio not working
- Grant microphone permissions in browser
- Check browser console for errors
- Verify WebSocket connection is established (check Network tab)
- Ensure backend is running and accessible

### Environment variables not loading
- Restart the server after changing `.env` files
- For React: Restart `npm start` after changing `.env`
- Verify `.env` files are in correct locations:
  - Backend: `backend/.env`
  - Frontend: `.env` (root directory)

## Azure Service Differences

### Azure OpenAI vs Azure Speech Services

**Azure OpenAI Realtime API:**
- Used for: Conversational AI with voice input/output
- Provides: Full conversation, TTS, STT, turn-taking
- Required for: Voice-only interview feature
- Resource type: Azure OpenAI

**Azure Speech Services:**
- Used for: Speech-to-text, text-to-speech, translation
- Provides: Transcription, voice synthesis
- Required for: Enhanced transcription (optional)
- Resource type: Cognitive Services - Speech Services

**Note:** These are different Azure resources. You may need both:
- Azure OpenAI resource for the interview conversation
- Azure Speech Services resource (like `projectespeech`) for additional features

## Security Best Practices

1. **Never commit `.env` files** - They are in `.gitignore`
2. **Use different keys for development and production**
3. **Rotate API keys regularly**
4. **Use Azure Key Vault in production** (instead of `.env` files)
5. **Restrict API key permissions** in Azure Portal

## Next Steps

After configuration:
1. Start both servers (backend and frontend)
2. Navigate to http://localhost:3000
3. Log in (demo: `demo@example.com` / `demo123`)
4. Go to Interviews → Select type → Start interview
5. Test the voice-only interview experience

## Support

For issues:
- Check backend logs for error messages
- Verify environment variables are set correctly
- Ensure Azure resources are active and accessible
- Review Azure Portal for quota/rate limit issues
