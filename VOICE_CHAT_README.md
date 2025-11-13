# Azure Realtime Voice Chat

A simple voice chat application using Azure's Realtime API with a Tkinter UI.

## Features

- 🎤 Real-time voice input with automatic speech detection (VAD)
- 🔊 Real-time audio output from the AI assistant
- 💬 Text transcript display of the conversation
- 🎨 Simple, user-friendly GUI

## Prerequisites

1. **Python 3.8+** installed
2. **PyAudio** - For audio input/output
   - On Windows: Usually installs via pip
   - On macOS: `brew install portaudio` then `pip install pyaudio`
   - On Linux: `sudo apt-get install portaudio19-dev` then `pip install pyaudio`

## Setup

1. **Install dependencies:**
   ```bash
   pip install python-dotenv websockets pyaudio azure-identity
   ```

2. **Configure environment variables:**
   - Your `.env` file already contains the required Azure credentials:
     - `AZURE_PROJECT_BASE`: Your Azure AI Foundry project URL
     - `AZURE_REALTIME_DEPLOYMENT`: Your deployment name (gpt-realtime)
     - `AZURE_OPENAI_API_KEY`: Your API key

## Running the Application

### Option 1: Using the batch file (Windows)
```bash
run_voice_chat.bat
```

### Option 2: Direct Python execution
```bash
python realtime_voice_chat.py
```

## How to Use

1. **Click "Start Voice Chat"** to connect to Azure Realtime API
2. **Wait for "Streaming microphone..."** status
3. **Speak into your microphone** - the AI will automatically detect when you're speaking
4. **Listen to the AI response** - both audio and text will be displayed
5. **Click "Stop"** when you're done
6. **Click "Clear Chat"** to clear the conversation history

## Troubleshooting

### PyAudio Installation Issues

**Windows:**
If pip fails, download the wheel file from [here](https://www.lfd.uci.edu/~gohlke/pythonlibs/#pyaudio) and install:
```bash
pip install PyAudio-0.2.14-cpXX-cpXX-win_amd64.whl
```

**macOS:**
```bash
brew install portaudio
pip install pyaudio
```

**Linux:**
```bash
sudo apt-get install portaudio19-dev python3-pyaudio
pip install pyaudio
```

### Microphone Not Working
- Check your system's microphone permissions
- Ensure your microphone is set as the default input device
- Test your microphone in other applications first

### Connection Errors
- Verify your `.env` file has the correct Azure credentials
- Check your internet connection
- Ensure the Azure deployment is active and accessible

## API Configuration

The application uses these environment variables from `.env`:

- `AZURE_PROJECT_BASE`: Azure AI Foundry project base URL
- `AZURE_PROJECT_PATH`: Project API path (default: `/api/projects/interactive`)
- `AZURE_REALTIME_DEPLOYMENT`: Deployment name (default: `gpt-realtime`)
- `AZURE_API_VERSION`: API version (default: `2025-04-01-preview`)
- `AZURE_OPENAI_API_KEY`: Your API key for authentication

## Technical Details

- **Audio Format**: PCM16, 16kHz, mono
- **Chunk Size**: 80ms audio chunks
- **VAD**: Server-side Voice Activity Detection
- **Protocol**: WebSocket-based realtime API
- **Authentication**: Azure API key or Azure AD token

## Notes

- The application uses server-side VAD (Voice Activity Detection) to automatically detect when you start and stop speaking
- Audio is streamed in real-time with low latency
- The AI responds with both audio and text simultaneously
- All conversations are ephemeral and not stored
