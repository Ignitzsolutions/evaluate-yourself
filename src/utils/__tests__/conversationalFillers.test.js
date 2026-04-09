import {
  CONVERSATIONAL_FILLER_PACK_VERSION,
  listConversationalFillerClips,
  normalizeConversationalFillerHint,
  pickConversationalFiller,
  pickConversationalFillerClip,
} from "../conversationalFillers";

describe("conversationalFillers", () => {
  it("normalizes unknown filler hints to thinking", () => {
    expect(normalizeConversationalFillerHint("bogus")).toBe("thinking");
    expect(normalizeConversationalFillerHint("pivot")).toBe("pivot");
  });

  it("returns deterministic fillers for the same hint and seed", () => {
    const first = pickConversationalFiller("acknowledgment", "seed-1");
    const second = pickConversationalFiller("acknowledgment", "seed-1");
    expect(first).toBe(second);
  });

  it("returns clip metadata with audio assets aligned to the backend pack version", () => {
    const clip = pickConversationalFillerClip("thinking", "seed-2");
    expect(clip.version).toBe(CONVERSATIONAL_FILLER_PACK_VERSION);
    expect(clip.audioSrc).toMatch(/^\/assets\/sonia-fillers\//);
    expect(clip.text).toBeTruthy();
  });

  it("lists all packaged filler clips for preloading", () => {
    const clips = listConversationalFillerClips();
    expect(clips).toHaveLength(9);
    expect(clips.every((clip) => clip.version === CONVERSATIONAL_FILLER_PACK_VERSION)).toBe(true);
  });
});
