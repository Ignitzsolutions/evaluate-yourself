# Quick Start Guide

## Starting the Application

### Option 1: Start Both Servers Together (Recommended)

```bash
./start-all.sh
```

This will start both the backend and frontend servers in the background.

### Option 2: Start Servers Separately

**Backend:**
```bash
./start-backend.sh
```

**Frontend:**
```bash
./start-frontend.sh
```

### Option 3: Using npm scripts

```bash
npm run start:all      # Start both servers
npm run start:backend  # Start backend only
npm run start:frontend # Start frontend only
```

## Access the Application

- **Frontend**: http://localhost:3001
- **Backend API**: http://localhost:8000
- **API Documentation**: http://localhost:8000/docs

## Configuration

1. **Backend Configuration** (`backend/.env`):
   - `AZURE_OPENAI_API_KEY` - Your Azure OpenAI API key
   - `AZURE_OPENAI_ENDPOINT` - Your Azure OpenAI endpoint
   - `AZURE_OPENAI_DEPLOYMENT_NAME` - Your deployment name
   - `AZURE_SPEECH_KEY` (optional) - Azure Speech Services key

2. **Frontend Configuration** (`.env`):
   - `REACT_APP_API_URL` - Backend API URL (default: http://localhost:8000)

## Troubleshooting

### Port Already in Use
The startup scripts will automatically try the next available port if the default port is in use.

### Backend Not Starting
- Check that `backend/.env` exists and has valid Azure OpenAI credentials
- Ensure Python virtual environment is activated
- Check `backend.log` for error messages

### Frontend Not Starting
- Ensure `node_modules` is installed (`npm install`)
- Check `frontend.log` for error messages

### WebSocket Connection Errors
- Ensure backend is running on port 8000
- Check that Azure OpenAI keys are configured correctly
- Verify CORS settings in `backend/app.py`

## Production Build

```bash
npm run build
```

The built files will be in the `build/` directory.
