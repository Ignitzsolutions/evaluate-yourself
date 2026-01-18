# Audio Setup Guide - Interactive Voice Interview

## Quick Start

1. **Backend Configuration** - Ensure Azure OpenAI keys are in `backend/.env`:
   ```bash
   AZURE_OPENAI_API_KEY=your-key-here
   AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com
   AZURE_OPENAI_DEPLOYMENT=gpt-4o-realtime
   ```

2. **Start Backend**:
   ```bash
   cd backend
   uvicorn app:app --host 0.0.0.0 --port 8000 --reload
   ```

3. **Start Frontend**:
   ```bash
   npm start
   ```

4. **Test Interview**:
   - Navigate to `http://localhost:3001/interview/behavioral`
   - Click "Join Interview"
   - Allow microphone and camera permissions
   - AI should start speaking immediately

## How It Works

### Audio Pipeline

1. **Browser captures microphone** → `getUserMedia()` with audio constraints
2. **AudioContext processes audio** → Converts to PCM16 at 24kHz
3. **ScriptProcessorNode** → Processes audio chunks (~85ms each)
4. **Resampling** → Converts from browser sample rate (usually 48kHz) to 24kHz
5. **PCM16 conversion** → Float32 [-1..1] → Int16 little-endian
6. **Base64 encoding** → Converts binary to base64 string
7. **WebSocket send** → Sends as JSON: `{type: 'input_audio_buffer.append', audio: base64}`
8. **Backend forwards** → Directly forwards to Azure OpenAI Realtime API
9. **Azure processes** → VAD detects speech, transcribes, responds

### Key Components

- **Frontend**: `src/hooks/useRealtimeInterview.js` - Handles audio capture and streaming
- **Backend**: `backend/app.py` - WebSocket proxy to Azure OpenAI
- **Audio Format**: PCM16, 24kHz, mono, little-endian

## Troubleshooting

### "Missing required parameter: 'item.content[0].audio'"

**Cause**: Trying to create conversation item without audio data.

**Fix**: Don't create `conversation.item.create` manually. Just start sending audio chunks - Azure Realtime handles VAD and creates items automatically.

### "NotAllowedError" - Microphone permission denied

**Fix**: 
- Ensure `getUserMedia()` is called inside a user click handler
- Check browser permissions (Chrome: Settings → Privacy → Site Settings → Microphone)
- Try a different browser

### Audio not being sent / Model not responding

**Check**:
1. Browser console - look for audio errors
2. Backend logs - should show audio chunks being received
3. WebSocket connection - ensure `connectionStatus === 'connected'`
4. Audio format - must be PCM16 24kHz base64

### Choppy/robot voice

**Causes**:
- Chunks too large (reduce buffer size)
- No resampling (ensure resampling to 24kHz)
- Network latency (check WebSocket ping)

**Fix**: Current implementation uses 4096 buffer size (~85ms chunks) which is optimal.

### Audio works once, then breaks after restart

**Cause**: AudioContext or tracks not properly cleaned up.

**Fix**: Current implementation properly stops tracks and disconnects nodes on cleanup.

## Debugging

### Frontend Logging

Check browser console for:
- `Audio setup: {inputSampleRate, targetSampleRate, contextState}`
- `Recording started - sending audio chunks`
- Any WebSocket errors

### Backend Logging

Check backend terminal for:
- `⚠️ Warning: Odd PCM chunk size` - indicates format issue
- `❌ Error forwarding to Azure` - connection or format issue
- Audio chunk sizes (should be even numbers for PCM16)

### Test Audio Format

Add this to frontend to verify audio:
```javascript
// In processor.onaudioprocess
const rms = Math.sqrt(inputData.reduce((sum, x) => sum + x*x, 0) / inputData.length);
console.log('Audio RMS:', rms); // Should be 0.02-0.10 when speaking
```

## Configuration

### Sample Rate
- **Target**: 24kHz (Azure OpenAI Realtime requirement)
- **Browser default**: Usually 48kHz (auto-resampled)

### Buffer Size
- **Current**: 4096 samples (~85ms at 48kHz)
- **Optimal range**: 2048-8192 samples

### Audio Constraints
```javascript
{
  echoCancellation: true,    // Reduces echo
  noiseSuppression: true,    // Reduces background noise
  autoGainControl: true      // Normalizes volume
}
```

## Production Checklist

- [ ] AudioContext.resume() called after getUserMedia
- [ ] Proper error handling for all audio errors
- [ ] Cleanup on disconnect (stop tracks, disconnect nodes)
- [ ] Logging for debugging
- [ ] Fallback for older browsers (ScriptProcessorNode)
- [ ] Network error handling
- [ ] Reconnection logic

## Next Steps

If audio still doesn't work:
1. Check browser console for specific errors
2. Check backend logs for Azure connection errors
3. Verify Azure OpenAI keys are correct
4. Test with a simple audio test (see debugging section)
