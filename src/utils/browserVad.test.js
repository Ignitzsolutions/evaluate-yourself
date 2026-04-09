import { calculateRmsFromFloat32Array, isSpeechFrame } from "./browserVad";

describe("browserVad helpers", () => {
  it("calculates RMS from a Float32Array", () => {
    const samples = new Float32Array([0.5, -0.5, 0.5, -0.5]);
    expect(calculateRmsFromFloat32Array(samples)).toBeCloseTo(0.5, 5);
  });

  it("classifies speech frames above threshold", () => {
    expect(isSpeechFrame(new Float32Array([0.03, -0.03]), 0.02)).toBe(true);
    expect(isSpeechFrame(new Float32Array([0.01, -0.01]), 0.02)).toBe(false);
  });
});

