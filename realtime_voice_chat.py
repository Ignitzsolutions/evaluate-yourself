import asyncio
import base64
import json
import os
import sys
import threading
import tkinter as tk
from tkinter import scrolledtext, ttk
from typing import Dict
import websockets
import pyaudio
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# ---------- Config ----------
AOAI_ENDPOINT = os.getenv("AZURE_OPENAI_ENDPOINT", "https://gpt-interactive-talk.cognitiveservices.azure.com/")
AOAI_RESOURCE = os.getenv("AZURE_OPENAI_RESOURCE", "gpt-interactive-talk")
REALTIME_DEPLOYMENT = os.getenv("AZURE_REALTIME_DEPLOYMENT", "gpt-4o-realtime-preview")
API_VERSION = os.getenv("AZURE_API_VERSION", "2024-10-01-preview")
AOAI_API_KEY = os.getenv("AZURE_OPENAI_API_KEY")

# Audio (16k/mono/16-bit)
SAMPLE_RATE = 16000
CHANNELS = 1
SAMPLE_WIDTH = 2
CHUNK_MS = 80
CHUNK_BYTES = int(SAMPLE_RATE * SAMPLE_WIDTH * CHUNK_MS / 1000)


# ---------- Auth helpers ----------
def build_ws_url_and_headers() -> (str, Dict[str, str]):
    """Build WebSocket URL and headers for authentication."""
    if not AOAI_API_KEY:
        raise RuntimeError("AZURE_OPENAI_API_KEY must be set in .env file")
    
    # Standard Azure Cognitive Services endpoint format
    ws_url = (
        AOAI_ENDPOINT.rstrip("/")
        + f"/openai/realtime?api-version={API_VERSION}&deployment={REALTIME_DEPLOYMENT}"
    )
    
    headers = {
        "api-key": AOAI_API_KEY
    }
    
    return ws_url.replace("https://", "wss://").replace("http://", "ws://"), headers


# ---------- Realtime Client ----------
class RealtimeVoiceClient:
    def __init__(self, ui_callback):
        self.ui_callback = ui_callback
        self.ws = None
        self.pa = None
        self.mic = None
        self.spk = None
        self.stop_event = None
        self.is_running = False
        self.partial_text = []

    async def send_session_update(self):
        await self.ws.send(json.dumps({
            "type": "session.update",
            "session": {
                "input_audio_format": {"type": "pcm16", "sample_rate_hz": SAMPLE_RATE},
                "output_audio_format": {"type": "pcm16", "sample_rate_hz": SAMPLE_RATE},
                "server_vad": {"type": "default"},
                "instructions": "Be concise and helpful. You are a friendly AI assistant."
            }
        }))

    async def mic_producer(self):
        self.ui_callback("🎤 Streaming microphone... Speak now!", "status")
        while not self.stop_event.is_set() and self.is_running:
            try:
                chunk = self.mic.read(CHUNK_BYTES, exception_on_overflow=False)
                await self.ws.send(json.dumps({
                    "type": "input_audio_buffer.append",
                    "audio": base64.b64encode(chunk).decode("ascii")
                }))
                await asyncio.sleep(CHUNK_MS / 1000)
            except Exception as e:
                if self.is_running:
                    self.ui_callback(f"❌ Mic error: {e}", "error")
                break

    async def event_consumer(self):
        while not self.stop_event.is_set() and self.is_running:
            try:
                evt = json.loads(await self.ws.recv())
                t = evt.get("type")
                
                if t == "session.created":
                    self.ui_callback("✅ Session created", "status")
                elif t == "session.updated":
                    self.ui_callback("✅ Session configured", "status")
                elif t == "input_audio_buffer.speech_started":
                    self.ui_callback("🗣️ You are speaking...", "user")
                elif t in ("input_audio_buffer.speech_stopped", "input_audio_buffer.committed"):
                    self.ui_callback("🤫 Processing your speech...", "status")
                elif t == "response.audio.delta":
                    delta = evt.get("delta")
                    if delta:
                        self.spk.write(base64.b64decode(delta))
                elif t == "response.text.delta":
                    d = evt.get("delta", "")
                    if d:
                        self.partial_text.append(d)
                        self.ui_callback("".join(self.partial_text), "assistant_partial")
                elif t == "response.text.done":
                    if self.partial_text:
                        self.ui_callback("".join(self.partial_text), "assistant")
                        self.partial_text.clear()
                elif t == "error":
                    self.ui_callback(f"❌ Error: {evt}", "error")
            except Exception as e:
                if self.is_running:
                    self.ui_callback(f"❌ Consumer error: {e}", "error")
                break

    async def start(self):
        try:
            self.stop_event = asyncio.Event()
            self.is_running = True

            # Initialize audio
            self.pa = pyaudio.PyAudio()
            self.mic = self.pa.open(
                format=self.pa.get_format_from_width(SAMPLE_WIDTH),
                channels=CHANNELS,
                rate=SAMPLE_RATE,
                input=True,
                frames_per_buffer=CHUNK_BYTES
            )
            self.spk = self.pa.open(
                format=self.pa.get_format_from_width(SAMPLE_WIDTH),
                channels=CHANNELS,
                rate=SAMPLE_RATE,
                output=True
            )

            # Connect to WebSocket
            ws_url, headers = build_ws_url_and_headers()
            self.ui_callback(f"🔌 Connecting to {ws_url}", "status")
            
            async with websockets.connect(ws_url, additional_headers=headers, max_size=None) as ws:
                self.ws = ws
                
                # Wait for session.created
                first = json.loads(await ws.recv())
                if first.get("type") != "session.created":
                    self.ui_callback(f"⚠️ Unexpected first event: {first}", "error")
                
                await self.send_session_update()
                
                # Start tasks
                consumer = asyncio.create_task(self.event_consumer())
                producer = asyncio.create_task(self.mic_producer())
                
                await self.stop_event.wait()
                
                for t in (producer, consumer):
                    t.cancel()

        except Exception as e:
            self.ui_callback(f"❌ Connection error: {e}", "error")
        finally:
            self.cleanup()

    def cleanup(self):
        if self.mic:
            self.mic.stop_stream()
            self.mic.close()
        if self.spk:
            self.spk.stop_stream()
            self.spk.close()
        if self.pa:
            self.pa.terminate()
        self.is_running = False

    def stop(self):
        self.is_running = False
        if self.stop_event:
            self.stop_event.set()


# ---------- UI ----------
class VoiceChatUI:
    def __init__(self, root):
        self.root = root
        self.root.title("Azure Realtime Voice Chat")
        self.root.geometry("800x600")
        
        self.client = None
        self.loop = None
        self.thread = None
        
        self.setup_ui()
        
    def setup_ui(self):
        # Title
        title = tk.Label(self.root, text="Azure Realtime Voice Chat", font=("Arial", 16, "bold"))
        title.pack(pady=10)
        
        # Status
        self.status_label = tk.Label(self.root, text="Ready to connect", fg="blue")
        self.status_label.pack()
        
        # Chat display
        frame = tk.Frame(self.root)
        frame.pack(padx=10, pady=10, fill=tk.BOTH, expand=True)
        
        self.chat_display = scrolledtext.ScrolledText(
            frame,
            wrap=tk.WORD,
            width=80,
            height=25,
            font=("Arial", 10)
        )
        self.chat_display.pack(fill=tk.BOTH, expand=True)
        self.chat_display.config(state=tk.DISABLED)
        
        # Tags for formatting
        self.chat_display.tag_config("user", foreground="blue", font=("Arial", 10, "bold"))
        self.chat_display.tag_config("assistant", foreground="green", font=("Arial", 10))
        self.chat_display.tag_config("status", foreground="gray", font=("Arial", 9, "italic"))
        self.chat_display.tag_config("error", foreground="red", font=("Arial", 10, "bold"))
        
        # Buttons
        button_frame = tk.Frame(self.root)
        button_frame.pack(pady=10)
        
        self.start_button = tk.Button(
            button_frame,
            text="Start Voice Chat",
            command=self.start_chat,
            bg="green",
            fg="white",
            font=("Arial", 12, "bold"),
            padx=20,
            pady=10
        )
        self.start_button.pack(side=tk.LEFT, padx=5)
        
        self.stop_button = tk.Button(
            button_frame,
            text="Stop",
            command=self.stop_chat,
            bg="red",
            fg="white",
            font=("Arial", 12, "bold"),
            padx=20,
            pady=10,
            state=tk.DISABLED
        )
        self.stop_button.pack(side=tk.LEFT, padx=5)
        
        self.clear_button = tk.Button(
            button_frame,
            text="Clear Chat",
            command=self.clear_chat,
            font=("Arial", 12),
            padx=20,
            pady=10
        )
        self.clear_button.pack(side=tk.LEFT, padx=5)
        
    def add_message(self, message, tag="status"):
        self.chat_display.config(state=tk.NORMAL)
        if tag == "assistant_partial":
            # Update last line for partial responses
            self.chat_display.delete("end-2l", "end-1l")
            self.chat_display.insert(tk.END, f"🤖 AI: {message}\n", "assistant")
        else:
            if tag == "user":
                self.chat_display.insert(tk.END, f"{message}\n", tag)
            elif tag == "assistant":
                self.chat_display.insert(tk.END, f"🤖 AI: {message}\n\n", tag)
            else:
                self.chat_display.insert(tk.END, f"{message}\n", tag)
        self.chat_display.see(tk.END)
        self.chat_display.config(state=tk.DISABLED)
        
    def update_status(self, status):
        self.status_label.config(text=status)
        
    def ui_callback(self, message, message_type):
        self.root.after(0, lambda: self.add_message(message, message_type))
        if message_type in ("status", "error"):
            self.root.after(0, lambda: self.update_status(message))
    
    def start_chat(self):
        self.start_button.config(state=tk.DISABLED)
        self.stop_button.config(state=tk.NORMAL)
        self.add_message("Starting voice chat...", "status")
        
        self.client = RealtimeVoiceClient(self.ui_callback)
        
        def run_async_loop():
            self.loop = asyncio.new_event_loop()
            asyncio.set_event_loop(self.loop)
            try:
                self.loop.run_until_complete(self.client.start())
            finally:
                self.loop.close()
                self.root.after(0, self.on_chat_stopped)
        
        self.thread = threading.Thread(target=run_async_loop, daemon=True)
        self.thread.start()
    
    def stop_chat(self):
        if self.client:
            self.client.stop()
        self.add_message("Stopping voice chat...", "status")
        
    def on_chat_stopped(self):
        self.start_button.config(state=tk.NORMAL)
        self.stop_button.config(state=tk.DISABLED)
        self.update_status("Disconnected")
        
    def clear_chat(self):
        self.chat_display.config(state=tk.NORMAL)
        self.chat_display.delete(1.0, tk.END)
        self.chat_display.config(state=tk.DISABLED)


# ---------- Main ----------
def main():
    root = tk.Tk()
    app = VoiceChatUI(root)
    root.mainloop()


if __name__ == "__main__":
    main()
