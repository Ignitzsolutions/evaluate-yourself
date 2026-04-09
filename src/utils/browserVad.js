export function calculateRmsFromFloat32Array(samples) {
  if (!samples || typeof samples.length !== "number" || samples.length === 0) {
    return 0;
  }
  let sum = 0;
  for (let i = 0; i < samples.length; i += 1) {
    const value = Number(samples[i] || 0);
    sum += value * value;
  }
  return Math.sqrt(sum / samples.length);
}

export function isSpeechFrame(samples, threshold = 0.02) {
  return calculateRmsFromFloat32Array(samples) >= threshold;
}

