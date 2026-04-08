const { expect, test } = require("@playwright/test");

function jsonResponse(body, status = 200) {
  return {
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  };
}

async function installBrowserMocks(page) {
  await page.addInitScript(() => {
    const createMediaStream = () => {
      if (typeof MediaStream !== "undefined") {
        return new MediaStream();
      }
      return {
        getTracks() {
          return [];
        },
        getAudioTracks() {
          return [];
        },
        getVideoTracks() {
          return [];
        },
      };
    };

    class FakeMediaStreamTrack {
      constructor(kind) {
        this.kind = kind;
        this.enabled = true;
        this.readyState = "live";
      }
      stop() {
        this.readyState = "ended";
      }
    }

    class FakeMediaStream {
      constructor() {
        this._tracks = [new FakeMediaStreamTrack("audio"), new FakeMediaStreamTrack("video")];
      }
      getTracks() {
        return this._tracks;
      }
      getAudioTracks() {
        return this._tracks.filter((track) => track.kind === "audio");
      }
      getVideoTracks() {
        return this._tracks.filter((track) => track.kind === "video");
      }
    }

    class FakeSpeechRecognition {
      constructor() {
        this.continuous = true;
        this.interimResults = false;
        this.lang = "en-US";
        this.maxAlternatives = 1;
      }
      start() {}
      stop() {}
      abort() {}
    }

    class FakeWebSocket {
      constructor(url) {
        this.url = url;
        this.readyState = 1;
        this.onopen = null;
        this.onmessage = null;
        this.onerror = null;
        this.onclose = null;
        setTimeout(() => {
          if (this.onopen) this.onopen({ type: "open" });
        }, 10);
      }
      send() {}
      close() {
        this.readyState = 3;
        if (this.onclose) this.onclose({ type: "close" });
      }
    }

    class FakeDataChannel {
      constructor() {
        this.readyState = "connecting";
        this.onopen = null;
        this.onmessage = null;
        this.onerror = null;
        this.onclose = null;
        this._opened = false;
        this._sent = [];
        setTimeout(() => {
          this.readyState = "open";
          this._opened = true;
          if (this.onopen) this.onopen({ type: "open" });
        }, 25);
      }

      _emit(payload) {
        if (this.onmessage) {
          this.onmessage({ data: JSON.stringify(payload) });
        }
      }

      send(raw) {
        this._sent.push(raw);
        let msg;
        try {
          msg = JSON.parse(raw);
        } catch {
          return;
        }

        if (msg.type === "session.update") {
          setTimeout(() => this._emit({ type: "session.created" }), 15);
          setTimeout(() => this._emit({ type: "session.updated" }), 45);
          return;
        }

        if (msg.type !== "response.create") {
          return;
        }

        const text = String(msg.response?.instructions || "Sonia is ready.").trim();
        const responseId = `resp-${Math.random().toString(36).slice(2, 9)}`;
        const itemId = `item-${Math.random().toString(36).slice(2, 9)}`;
        setTimeout(() => this._emit({ type: "response.output_item.added", item: { id: itemId } }), 15);
        setTimeout(() => this._emit({ type: "output_audio_buffer.started" }), 20);
        setTimeout(() => this._emit({ type: "response.output_text.delta", response_id: responseId, delta: text.slice(0, 24) }), 25);
        setTimeout(() => this._emit({ type: "response.output_audio_transcript.delta", response_id: responseId, delta: text.slice(0, 24) }), 30);
        setTimeout(() => this._emit({ type: "response.output_text.done", response_id: responseId, text }), 55);
        setTimeout(() => this._emit({ type: "response.output_audio_transcript.done", response_id: responseId, text }), 65);
        setTimeout(() => this._emit({ type: "output_audio_buffer.stopped" }), 70);
        setTimeout(() => this._emit({ type: "response.completed", response_id: responseId }), 80);

        if (!this._userTurnScheduled) {
          this._userTurnScheduled = true;
          setTimeout(() => this._emit({ type: "input_audio_buffer.speech_started" }), 140);
          setTimeout(() => this._emit({ type: "input_audio_buffer.committed", item_id: "user-item-1" }), 180);
          setTimeout(() => this._emit({
            type: "input_audio_transcription.completed",
            item_id: "user-item-1",
            text: "I led a deployment migration with zero downtime and measured rollback risk.",
          }), 220);
          setTimeout(() => this._emit({ type: "input_audio_buffer.speech_stopped" }), 240);
        }
      }

      close() {
        this.readyState = "closed";
        if (this.onclose) this.onclose({ type: "close" });
      }
    }

    class FakeRTCPeerConnection {
      constructor() {
        this.connectionState = "new";
        this.iceConnectionState = "new";
        this.signalingState = "stable";
        this.onconnectionstatechange = null;
        this.oniceconnectionstatechange = null;
        this.ontrack = null;
      }

      addTrack() {}

      createDataChannel() {
        this._dataChannel = new FakeDataChannel();
        return this._dataChannel;
      }

      async createOffer() {
        return { type: "offer", sdp: "v=0\n" };
      }

      async setLocalDescription() {
        setTimeout(() => {
          this.connectionState = "connected";
          this.iceConnectionState = "connected";
          if (this.onconnectionstatechange) this.onconnectionstatechange();
          if (this.oniceconnectionstatechange) this.oniceconnectionstatechange();
        }, 20);
      }

      async setRemoteDescription() {
        setTimeout(() => {
          if (this.ontrack) {
            this.ontrack({ streams: [createMediaStream()] });
          }
        }, 25);
      }

      close() {
        this.connectionState = "closed";
        if (this.onconnectionstatechange) this.onconnectionstatechange();
      }
    }

    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: async () => createMediaStream(),
      },
    });

    window.SpeechRecognition = FakeSpeechRecognition;
    window.webkitSpeechRecognition = FakeSpeechRecognition;
    window.WebSocket = FakeWebSocket;
    window.RTCPeerConnection = FakeRTCPeerConnection;
    window.webkitRTCPeerConnection = FakeRTCPeerConnection;
    window.speechSynthesis = {
      cancel() {},
      speak() {},
      getVoices() {
        return [];
      },
      speaking: false,
      pending: false,
      paused: false,
    };

    if (window.HTMLMediaElement && window.HTMLMediaElement.prototype) {
      window.HTMLMediaElement.prototype.play = function play() {
        return Promise.resolve();
      };
      window.HTMLMediaElement.prototype.pause = function pause() {};
    }
  });
}

async function installNetworkMocks(page) {
  await page.route("http://127.0.0.1:7242/**", async (route) => {
    await route.fulfill({ status: 204, body: "" });
  });

  await page.route("**/api/realtime/webrtc", async (route) => {
    await route.fulfill(
      jsonResponse({
        sdpAnswer: "v=0\n",
        azureEndpoint: "https://mock.openai.invalid/realtime",
        region: "mock-region",
        deployment: "mock-deployment",
      }),
    );
  });
}

test.describe("interview smoke", () => {
  test("drives the realtime runtime with mocked browser and API dependencies", async ({ page }) => {
    await installBrowserMocks(page);
    await installNetworkMocks(page);

    const consoleErrors = [];
    page.on("console", (message) => {
      if (message.type() === "error") {
        consoleErrors.push(message.text());
      }
    });

    await page.goto("/test-realtime");
    const connectButton = page.getByRole("button", { name: "Connect", exact: true });
    await expect(connectButton).toBeVisible();

    await connectButton.click();

    await expect(page.getByText(/^Status:\s*connected$/)).toBeVisible();
    await expect(page.getByText("Mic Active")).toBeVisible();
    await expect(page.getByText("Session updated")).toBeVisible();
    await expect(page.getByText("User started speaking")).toBeVisible();
    await expect(page.getByText(/^AI:/)).toBeVisible();

    expect(consoleErrors).toEqual([]);
  });
});
