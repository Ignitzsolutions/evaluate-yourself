import { mapLiveGazeFlag } from "../gazeDirection";

describe("mapLiveGazeFlag", () => {
  it("uses active flag when present", () => {
    expect(mapLiveGazeFlag("LOOKING_DOWN", "ON_SCREEN")).toBe("LOOKING_DOWN");
  });

  it("maps horizontal gaze directions to off-screen", () => {
    expect(mapLiveGazeFlag(null, "LEFT")).toBe("OFF_SCREEN");
    expect(mapLiveGazeFlag(null, "RIGHT")).toBe("OFF_SCREEN");
  });

  it("maps vertical gaze directions to explicit live flags", () => {
    expect(mapLiveGazeFlag(null, "DOWN")).toBe("LOOKING_DOWN");
    expect(mapLiveGazeFlag(null, "UP")).toBe("LOOKING_UP");
  });

  it("maps no-face and leaves on-screen unset", () => {
    expect(mapLiveGazeFlag(null, "NO_FACE")).toBe("FACE_NOT_VISIBLE");
    expect(mapLiveGazeFlag(null, "ON_SCREEN")).toBeNull();
  });
});
