export function formatInterviewTypeLabel(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return "-";
  if (raw === "mixed") return "360 Interview";
  if (raw === "technical") return "Technical";
  if (raw === "behavioral") return "Behavioral";
  return raw
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

