import AudioBufferService from "./AudioBufferService";

function createFakeAudio(src) {
  return {
    src,
    currentTime: 0,
    volume: 1,
    preload: "",
    listeners: {},
    load: jest.fn(),
    addEventListener(event, handler) {
      this.listeners[event] = handler;
    },
    removeEventListener(event, handler) {
      if (this.listeners[event] === handler) {
        delete this.listeners[event];
      }
    },
    play: jest.fn(() => Promise.resolve()),
    pause: jest.fn(),
  };
}

describe("AudioBufferService", () => {
  it("preloads and reuses clip audio objects", () => {
    const created = [];
    const service = new AudioBufferService({
      createAudio: (src) => {
        const audio = createFakeAudio(src);
        created.push(audio);
        return audio;
      },
    });

    service.preload([
      { audioSrc: "/assets/sonia-fillers/thinking/think-1.m4a" },
      { audioSrc: "/assets/sonia-fillers/thinking/think-1.m4a" },
    ]);

    expect(created).toHaveLength(1);
    expect(created[0].load).toHaveBeenCalledTimes(1);
  });

  it("plays the selected clip and stops active playback cleanly", async () => {
    const service = new AudioBufferService({ createAudio: createFakeAudio });
    service.preload([{ audioSrc: "/assets/sonia-fillers/pivot/pivot-1.m4a" }]);

    const finished = jest.fn();
    const started = await service.play(
      { audioSrc: "/assets/sonia-fillers/pivot/pivot-1.m4a" },
      { onEnded: finished },
    );

    expect(started).toBe(true);
    const cached = service.cache.get("/assets/sonia-fillers/pivot/pivot-1.m4a");
    expect(cached.play).toHaveBeenCalledTimes(1);

    cached.listeners.ended();
    expect(finished).toHaveBeenCalledTimes(1);

    await service.play({ audioSrc: "/assets/sonia-fillers/pivot/pivot-1.m4a" });
    service.stop();
    expect(cached.pause).toHaveBeenCalled();
    expect(cached.currentTime).toBe(0);
  });
});
