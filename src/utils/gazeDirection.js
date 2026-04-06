export function mapLiveGazeFlag(activeFlag, gazeDirection) {
  if (activeFlag) return String(activeFlag).toUpperCase();

  const direction = String(gazeDirection || "").toUpperCase();
  if (direction === "LEFT" || direction === "RIGHT") return "OFF_SCREEN";
  if (direction === "DOWN") return "LOOKING_DOWN";
  if (direction === "UP") return "LOOKING_UP";
  if (direction === "NO_FACE") return "FACE_NOT_VISIBLE";
  return null;
}
