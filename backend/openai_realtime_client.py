"""OpenAI Realtime microphone client for Evaluate-Yourself."""

import asyncio
import base64
import json
import os
import signal
from typing import Optional

import pyaudio
import websockets
from websockets.asyncio.client import ClientConnection
from websockets.exceptions import ConnectionClosedError, ConnectionClosedOK

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY") or os.getenv("OPENAI_REALTIME_API_KEY")
OPENAI_REALTIME_MODEL = os.getenv("OPENAI_REALTIME_MODEL", "gpt-4o-realtime-preview")
SESSION_INSTRUCTIONS = os.getenv("OPENAI_REALTIME_INSTRUCTIONS", "Be concise and helpful.")
REALTIME_VOICE = os.getenv("REALTIME_VOICE", "alloy")

# Audio (16k/mono/16-bit)
SAMPLE_RATE = 16000
CHANNELS = 1
SAMPLE_WIDTH = 2
CHUNK_MS = 80
CHUNK_FRAMES = int(SAMPLE_RATE * CHUNK_MS / 1000)

stop_event: Optional[asyncio.Event] = None


async def send_session_update(ws: ClientConnection) -> None:
    payload = {
        "type": "session.update",
        "session": {
            "modalities": ["text", "audio"],
            "voice": REALTIME_VOICE,
            "instructions": SESSION_INSTRUCTIONS,
            "input_audio_format": {"type": "pcm16", "sample_rate_hz": SAMPLE_RATE},
            "output_audio_format": {"type": "pcm16", "sample_rate_hz": SAMPLE_RATE},
            "server_vad": {"type": "default"},
        },
    }
    await ws.send(json.dumps(payload))


async def mic_producer(
    ws: ClientConnection,
    shutdown_event: asyncio.Event,
    mic_stream: pyaudio.Stream,
) -> None:
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
    partial: list[str] = []
    try:
        while not shutdown_event.is_set():
            evt = json.loads(await ws.recv())
            evt_type = evt.get("type")
            if evt_type == "response.audio.delta":
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
    except asyncio.CancelledError:
        pass
    except (ConnectionClosedError, ConnectionClosedOK):
        shutdown_event.set()


def handle_signal(*_: object) -> None:
    if stop_event:
        stop_event.set()


async def main() -> None:
    global stop_event
    if not OPENAI_API_KEY:
        raise RuntimeError("Set OPENAI_API_KEY (or OPENAI_REALTIME_API_KEY).")

    stop_event = asyncio.Event()
    signal.signal(signal.SIGINT, handle_signal)
    try:
        signal.signal(signal.SIGTERM, handle_signal)
    except AttributeError:
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

        ws_url = f"wss://api.openai.com/v1/realtime?model={OPENAI_REALTIME_MODEL}"
        async with websockets.connect(
            ws_url,
            additional_headers={"Authorization": f"Bearer {OPENAI_API_KEY}"},
            subprotocols=["realtime"],
            max_size=None,
        ) as ws:
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
    asyncio.run(main())
