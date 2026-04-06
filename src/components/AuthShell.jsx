import React from "react";

export default function AuthShell({
  eyebrow,
  title,
  subtitle,
  highlights = [],
  children,
}) {
  return (
    <div className="clerk-shell">
      <div className="clerk-bg-orb orb-a" />
      <div className="clerk-bg-orb orb-b" />
      <div className="clerk-bg-orb orb-c" />

      <section className="clerk-panel">
        <div className="clerk-hero">
          <div className="clerk-brand-row">
            <div className="clerk-brand-mark" />
            <div>
              <div className="clerk-brand-name">Evaluate Yourself</div>
              <div className="clerk-brand-sub">{eyebrow}</div>
            </div>
          </div>

          <h1>{title}</h1>
          <p>{subtitle}</p>

          {highlights.length > 0 && (
            <div className="clerk-info-grid">
              {highlights.map((item) => (
                <div className="clerk-info-card" key={item.title}>
                  <div className="clerk-info-title">{item.title}</div>
                  <div className="clerk-info-body">{item.body}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="clerk-form-wrap">
          {children}
        </div>
      </section>
    </div>
  );
}
