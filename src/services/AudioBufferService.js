export default class AudioBufferService {
  constructor({ createAudio } = {}) {
    this.createAudio =
      createAudio ||
      ((src) => {
        if (typeof Audio === "undefined") {
          return null;
        }
        return new Audio(src);
      });
    this.cache = new Map();
    this.activeAudio = null;
    this.activeCleanup = null;
  }

  preload(clips = []) {
    clips.forEach((clip) => {
      const src = String(clip?.audioSrc || "").trim();
      if (!src || this.cache.has(src)) {
        return;
      }
      const audio = this.createAudio(src);
      if (!audio) {
        return;
      }
      audio.preload = "auto";
      if (typeof audio.load === "function") {
        try {
          audio.load();
        } catch {
          // no-op
        }
      }
      this.cache.set(src, audio);
    });
  }

  async play(clip, { volume = 1, onEnded, onError } = {}) {
    const src = String(clip?.audioSrc || "").trim();
    if (!src) {
      return false;
    }

    this.stop();

    const audio = this.cache.get(src) || this.createAudio(src);
    if (!audio) {
      return false;
    }
    this.cache.set(src, audio);
    audio.preload = "auto";
    audio.currentTime = 0;
    audio.volume = Number.isFinite(volume) ? volume : 1;

    const cleanup = () => {
      if (this.activeAudio !== audio) {
        return;
      }
      if (typeof audio.removeEventListener === "function") {
        audio.removeEventListener("ended", handleEnded);
        audio.removeEventListener("error", handleError);
      } else {
        audio.onended = null;
        audio.onerror = null;
      }
      this.activeAudio = null;
      this.activeCleanup = null;
    };

    const handleEnded = () => {
      cleanup();
      if (typeof onEnded === "function") {
        onEnded();
      }
    };

    const handleError = () => {
      cleanup();
      if (typeof onError === "function") {
        onError();
      }
    };

    if (typeof audio.addEventListener === "function") {
      audio.addEventListener("ended", handleEnded);
      audio.addEventListener("error", handleError);
    } else {
      audio.onended = handleEnded;
      audio.onerror = handleError;
    }

    this.activeAudio = audio;
    this.activeCleanup = cleanup;

    try {
      const playback = typeof audio.play === "function" ? audio.play() : null;
      if (playback && typeof playback.then === "function") {
        await playback;
      }
      return true;
    } catch {
      cleanup();
      if (typeof onError === "function") {
        onError();
      }
      return false;
    }
  }

  stop() {
    const audio = this.activeAudio;
    const cleanup = this.activeCleanup;
    if (!audio) {
      return;
    }
    if (typeof audio.pause === "function") {
      try {
        audio.pause();
      } catch {
        // no-op
      }
    }
    try {
      audio.currentTime = 0;
    } catch {
      // no-op
    }
    if (typeof cleanup === "function") {
      cleanup();
    }
  }
}
