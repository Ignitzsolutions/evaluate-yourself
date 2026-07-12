# Realtime Provider Matrix

This project should now be treated as provider-agnostic at the product level, with two target runtime modes.

## Provider modes

### `openai_native`

Use OpenAI for the full live interview path.

Capabilities:

- realtime session bootstrap
- streaming transcription
- interviewer reasoning
- low-latency Sonia audio output

Best fit:

- fastest path to parity with the current realtime experience
- simplest transport model
- least backend orchestration complexity

Tradeoffs:

- vendor coupling remains concentrated in one provider
- regional latency depends on OpenAI routing for your users

### `sarvam_hybrid`

Use Sarvam for speech streaming and OpenAI for interviewer intelligence.

Capabilities:

- Sarvam streaming STT
- OpenAI question planning, evaluation, and report reasoning
- Sarvam streaming TTS
- backend-owned realtime session orchestration

Best fit:

- India-focused speech latency strategy
- stronger control over the transport layer
- easier future swap of speech and reasoning independently

Tradeoffs:

- more backend complexity
- more failure points across STT, reasoning, and TTS boundaries
- no single native speech-to-speech session primitive in the same shape as OpenAI Realtime

## Required external API capabilities

The product needs these capability contracts regardless of provider:

| Capability | Needed for | OpenAI native | Sarvam hybrid |
| --- | --- | --- | --- |
| Realtime session bootstrap | Sonia live connection | OpenAI Realtime | Backend session + websocket |
| Streaming transcription | user speech to text | OpenAI realtime transcription | Sarvam STT websocket |
| Turn reasoning | next question, adaptive follow-up, evaluation | OpenAI | OpenAI |
| Streaming TTS | Sonia audio output | OpenAI Realtime audio | Sarvam streaming TTS |
| Batch transcription fallback | report integrity recovery | optional OpenAI transcription | optional OpenAI or Sarvam fallback |

## Recommended default

Ship `openai_native` first for lowest migration risk, and keep `sarvam_hybrid` as the explicit second runtime mode for India-focused latency optimization.

## Environment contract direction

The runtime should converge on provider-neutral configuration like:

- `AI_PROVIDER=openai_native|sarvam_hybrid`
- `OPENAI_API_KEY`
- `OPENAI_CHAT_MODEL`
- `OPENAI_REALTIME_MODEL`
- `SARVAM_API_KEY`
- `SARVAM_STT_WS_URL`
- `SARVAM_TTS_WS_URL`

The frontend should talk to one backend-owned realtime bootstrap contract and should not need vendor-specific endpoint knowledge.
