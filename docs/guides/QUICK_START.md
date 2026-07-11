# Quick Start Guide

## Start the application

### Option 1: Start both servers together

```bash
./start-all.sh
```

### Option 2: Start separately

Backend:

```bash
./start-backend.sh
```

Frontend:

```bash
./start-frontend.sh
```

### Option 3: npm scripts

```bash
npm run start:all
npm run start:backend
npm run start:frontend
```

## Access points

- Frontend: `http://localhost:3001`
- Backend API: `http://localhost:8000`
- API docs: `http://localhost:8000/docs`

## Minimal configuration

Backend:

- create `backend/.env`
- choose `AI_PROVIDER=openai_native|sarvam_hybrid`
- add the matching provider credentials

Frontend:

- set `REACT_APP_API_URL` if the backend is not on `http://localhost:8000`

## Fast checks

- open `/health`
- open `/docs`
- open the interview flow
- verify the realtime bootstrap endpoint responds through the backend

## Common problems

### Backend not starting

- run `uv sync`
- check that `backend/.env` exists
- confirm the provider credentials are present for the selected mode

### Frontend not starting

- run `npm install`
- check `frontend.log`

### Realtime connection errors

- verify the backend is reachable on port `8000`
- verify the selected provider is configured correctly
- check browser microphone permissions

## Production build

```bash
npm run build
```
