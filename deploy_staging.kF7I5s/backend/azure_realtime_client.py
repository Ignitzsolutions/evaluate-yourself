"""Azure Realtime microphone client for Evaluate-Yourself."""

import asyncio
import base64
import json
import os
import signal
import sys
from typing import Dict, Optional, Tuple

import pyaudio
import websockets
from websockets.asyncio.client import ClientConnection
from websockets.exceptions import ConnectionClosedError, ConnectionClosedOK

# ---------- Config ----------
# Option A: Azure AI Foundry project endpoint
PROJECT_BASE = os.getenv("AZURE_PROJECT_BASE", "https://gpt-interactive-talk.services.ai.azure.com")
PROJECT_PATH = os.getenv("AZURE_PROJECT_PATH", "/api/projects/interactive")
REALTIME_DEPLOYMENT = os.getenv("AZURE_REALTIME_DEPLOYMENT", "gpt-realtime")
API_VERSION = os.getenv("AZURE_API_VERSION", "2025-04-01-preview")

# Option B: classic Azure OpenAI resource (leave blank if not using)
AOAI_RESOURCE = os.getenv("AZURE_OPENAI_RESOURCE")
AOAI_API_KEY = os.getenv("AZURE_OPENAI_API_KEY")

# Audio (16k/mono/16-bit)
SAMPLE_RATE = 16000
CHANNELS = 1
SAMPLE_WIDTH = 2
CHUNK_MS = 80
CHUNK_FRAMES = int(SAMPLE_RATE * CHUNK_MS / 1000)
CHUNK_BYTES = CHUNK_FRAMES * SAMPLE_WIDTH

# Optional prompt override for the realtime session
SESSION_INSTRUCTIONS = os.getenv("AZURE_REALTIME_INSTRUCTIONS", "Be concise and helpful.")

stop_event: Optional[asyncio.Event] = None


def build_ws_url_and_headers() -> Tuple[str, Dict[str, str]]:
    """
    Prefer the Azure AI Foundry project endpoint when PROJECT_BASE is set,
    fall back to a classic Azure OpenAI resource otherwise.
    """
    headers: Dict[str, str] = {}

    if PROJECT_BASE:
        base_url = PROJECT_BASE.rstrip("/")
        path = (PROJECT_PATH or "").strip()
        if path and not base_url.endswith(path):
            base_url = base_url + "/" + path.lstrip("/")

        ws_url = (
            base_url.rstrip("/")
            + "/openai/realtime"
            + f"?deployment={REALTIME_DEPLOYMENT}&api-version={API_VERSION}"
        )

        token: Optional[str] = None
        try:
            from azure.identity import DefaultAzureCredential

            cred = DefaultAzureCredential()
            token = cred.get_token("https://cognitiveservices.azure.com/.default").token
        except Exception:
            print(
                "Warning: AAD token acquisition failed; falling back to API key if provided.",
                file=sys.stderr,
            )

        if token:
            headers["Authorization"] = f"Bearer {token}"
        elif AOAI_API_KEY:
            headers["api-key"] = AOAI_API_KEY
        else:
            raise RuntimeError(
                "Provide either Azure AD credentials or AZURE_OPENAI_API_KEY for project access."
            )

        secure_ws_url = ws_url.replace("https://", "wss://").replace("http://", "ws://")
        return secure_ws_url, headers

    if not AOAI_RESOURCE or not AOAI_API_KEY:
        raise RuntimeError("Set AZURE_OPENAI_RESOURCE and AZURE_OPENAI_API_KEY when not using a Foundry project.")

    ws_url = (
        f"wss://{AOAI_RESOURCE}.openai.azure.com/openai/realtime"
        f"?deployment={REALTIME_DEPLOYMENT}&api-version={API_VERSION}"
    )
    headers["api-key"] = AOAI_API_KEY
    return ws_url, headers


async def send_session_update(ws: ClientConnection) -> None:
    """Configure the realtime session for bi-directional audio."""
    payload = {
        "type": "session.update",
        "session": {
            "project": PROJECT_PATH,
            "modalities": ["text", "audio"],
            "instructions": SESSION_INSTRUCTIONS,
            "input_audio_format": {"type": "pcm16", "sample_rate_hz": SAMPLE_RATE},
            "output_audio_format": {"type": "pcm16", "sample_rate_hz": SAMPLE_RATE},
            "server_vad": {"type": "default"},
        },
    }
    voice = os.getenv("AZURE_REALTIME_VOICE")
    if voice:
        payload["session"]["voice"] = voice

    await ws.send(json.dumps(payload))


async def mic_producer(
    ws: ClientConnection,
    shutdown_event: asyncio.Event,
    mic_stream: pyaudio.Stream,
) -> None:
    """Stream microphone audio to the websocket."""
    print("🎤 Streaming mic… press Ctrl+C to stop.")
    try:
        while not shutdown_event.is_set():
            chunk = mic_stream.read(CHUNK_FRAMES, exception_on_overflow=False)
            await ws.send(
                json.dumps(
                    {
                        "type": "input_audio_buffer.append",
                        "audio": base64.b64encode(chunk).decode("ascii"),
                    }
                )
            )
            await asyncio.sleep(CHUNK_MS / 1000)
    except asyncio.CancelledError:
        pass


async def event_consumer(
    ws: ClientConnection,
    shutdown_event: asyncio.Event,
    speaker_stream: pyaudio.Stream,
) -> None:
    """Render events from the realtime session."""
    partial: list[str] = []
    try:
        while not shutdown_event.is_set():
            message = await ws.recv()
            evt = json.loads(message)
            evt_type = evt.get("type")

            if evt_type == "session.created":
                print("✅ Session created.")
            elif evt_type == "session.updated":
                print("✅ Session configured.")
            elif evt_type == "input_audio_buffer.speech_started":
                print("🗣️  VAD start")
            elif evt_type in ("input_audio_buffer.speech_stopped", "input_audio_buffer.committed"):
                print("🔇 VAD stop/commit")
            elif evt_type == "response.audio.delta":
                delta = evt.get("delta")
                if delta:
                    speaker_stream.write(base64.b64decode(delta))
            elif evt_type == "response.text.delta":
                delta_text = evt.get("delta", "")
                if delta_text:
                    partial.append(delta_text)
                    print("\r📝 " + "".join(partial), end="", flush=True)
            elif evt_type == "response.text.done":
                print()
                partial.clear()
            elif evt_type == "error":
                print(f"❌ Error event: {evt}", file=sys.stderr)
    except asyncio.CancelledError:
        pass
    except (ConnectionClosedError, ConnectionClosedOK):
        shutdown_event.set()


def handle_signal(*_: object) -> None:
    if stop_event:
        stop_event.set()


async def main() -> None:
    global stop_event
    stop_event = asyncio.Event()

    signal.signal(signal.SIGINT, handle_signal)
    try:
        signal.signal(signal.SIGTERM, handle_signal)
    except AttributeError:
        # SIGTERM is not available on some platforms (e.g., Windows).
        pass

    pa = pyaudio.PyAudio()
    mic_stream = speaker_stream = None

    try:
        fmt = pa.get_format_from_width(SAMPLE_WIDTH)
        mic_stream = pa.open(
            format=fmt,
            channels=CHANNELS,
            rate=SAMPLE_RATE,
            input=True,
            frames_per_buffer=CHUNK_FRAMES,
        )
        speaker_stream = pa.open(
            format=fmt,
            channels=CHANNELS,
            rate=SAMPLE_RATE,
            output=True,
        )

        ws_url, headers = build_ws_url_and_headers()
        print(f"Connecting to {ws_url}")

        async with websockets.connect(
            ws_url,
            additional_headers=headers,
            subprotocols=["chatgpt-realtime"],
            max_size=None,
        ) as ws:
            first_event = json.loads(await ws.recv())
            if first_event.get("type") != "session.created":
                print(f"⚠️ Unexpected first event: {first_event}")

            await send_session_update(ws)

            consumer_task = asyncio.create_task(event_consumer(ws, stop_event, speaker_stream))
            producer_task = asyncio.create_task(mic_producer(ws, stop_event, mic_stream))

            await stop_event.wait()

            for task in (producer_task, consumer_task):
                task.cancel()
            await asyncio.gather(producer_task, consumer_task, return_exceptions=True)

    finally:
        if mic_stream:
            mic_stream.stop_stream()
            mic_stream.close()
        if speaker_stream:
            speaker_stream.stop_stream()
            speaker_stream.close()
        pa.terminate()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
