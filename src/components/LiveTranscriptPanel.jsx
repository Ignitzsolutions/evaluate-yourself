import React, { useMemo } from "react";

export default function LiveTranscriptPanel({ partial, finals }) {
  const full = useMemo(
    () => finals.map((f) => f.text).join(" "),
    [finals]
  );
  return (
    <div style={{
      background: "#fff", borderRadius: 12, padding: 16,
      boxShadow: "0 2px 8px rgba(0,0,0,0.06)", minHeight: 120
    }}>
      <div style={{ color: "#111", lineHeight: 1.6, fontSize: 16 }}>
        {full} {partial ? <span style={{ opacity: 0.6 }}>{partial.text}</span> : null}
      </div>
    </div>
  );
}