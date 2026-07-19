import React from "react";

export default function AuthShell({
  eyebrow,
  title,
  subtitle,
  highlights = [],
  children,
}) {
  const statusItems = [
    ["Access", "Free launch"],
    ["Runtime", "Live workspace"],
    ["Reports", "Saved evidence"],
  ];

  return (
    <div className="clerk-shell">
      <div className="clerk-bg-orb orb-a" />
      <div className="clerk-bg-orb orb-b" />
      <div className="clerk-bg-orb orb-c" />

      <section className="clerk-panel">
        <div className="clerk-hero">
          <div className="clerk-brand-row">
            <img
              src="/assets/logo.png"
              alt="Evaluate Yourself logo"
              width="44"
              height="44"
              className="clerk-brand-mark"
            />
            <div>
              <div className="clerk-brand-name">Evaluate Yourself</div>
              <div className="clerk-brand-sub">An Ignitz product</div>
            </div>
          </div>

          <div className="clerk-eyebrow">{eyebrow}</div>
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

          <div className="clerk-hero-note">
            Designed as an interview workspace, not a generic SaaS dashboard. The focus is on clarity, state, and the live coaching loop.
          </div>

          <dl className="clerk-status-strip" aria-label="Workspace status">
            {statusItems.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="clerk-form-wrap">{children}</div>
      </section>
    </div>
  );
}
