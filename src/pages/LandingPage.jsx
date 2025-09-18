import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "../ui.css";

export default function LandingPage() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY;
      setIsScrolled(scrollTop > 50);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div style={{ minHeight: "100vh", display: "grid", gridTemplateRows: "auto 1fr", background: "#f7f9fc" }}>
      {/* Glossy header */}
      <header className="glossy-header">
        <div className="glossy-inner">
          {/* Left: Logo */}
          <div className="brand-section">
            <Link to="/" style={{ display: "flex", alignItems: "center", gap: "8px", textDecoration: "none", color: "inherit" }}>
              <img 
                src="/assets/logo.png" 
                alt="Evaluate Yourself Logo"
                style={{
                  width: isScrolled ? 28 : 36, 
                  height: isScrolled ? 28 : 36, 
                  borderRadius: "12px",
                  transition: "all 0.3s ease-in-out"
                }} 
              />
              <strong style={{ 
                fontSize: isScrolled ? "14px" : "16px",
                transition: "all 0.3s ease-in-out"
              }}>Evaluate Yourself</strong>
            </Link>
          </div>

          {/* Center: Navigation */}
          <nav className="nav-center">
            <a href="#features" style={{ 
              color: "#374151", 
              textDecoration: "none",
              fontSize: isScrolled ? "13px" : "14px",
              transition: "all 0.3s ease-in-out"
            }}>Features</a>
            <a href="#howitworks" style={{ 
              color: "#374151", 
              textDecoration: "none",
              fontSize: isScrolled ? "13px" : "14px",
              transition: "all 0.3s ease-in-out"
            }}>How it works</a>
            <a href="#faq" style={{ 
              color: "#374151", 
              textDecoration: "none",
              fontSize: isScrolled ? "13px" : "14px",
              transition: "all 0.3s ease-in-out"
            }}>FAQ</a>
          </nav>

          {/* Right: Action buttons */}
          <div className="nav-right">
            {!user ? (
              <Link to="/login" className="btn btn-primary" style={{
                fontSize: isScrolled ? "13px" : "14px",
                padding: isScrolled ? "6px 12px" : "8px 14px",
                transition: "all 0.3s ease-in-out"
              }}>Login</Link>
            ) : (
              <>
                <button onClick={() => nav("/interview-config")} className="btn" style={{
                  background: "#111827", 
                  color: "#fff",
                  fontSize: isScrolled ? "13px" : "14px",
                  padding: isScrolled ? "6px 12px" : "8px 14px",
                  transition: "all 0.3s ease-in-out"
                }}>Go to App</button>
                <button onClick={logout} className="btn btn-ghost" style={{
                  fontSize: isScrolled ? "13px" : "14px",
                  padding: isScrolled ? "6px 10px" : "8px 12px",
                  transition: "all 0.3s ease-in-out"
                }}>Logout</button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="hero">
        <div className="hero-inner">
          <div>
            <h1 className="hero-title">
              Ace your next interview with <span style={{ color: "#1E88E5" }}>AI-powered feedback</span>.
            </h1>
            <p className="hero-sub">
              Practice in a realistic, guided environment. Get live captions, eye-contact coaching, speaking pace,
              and a detailed report covering communication, programming, or behavioural skills.
            </p>
            <div className="hero-cta">
              {!user ? (
                <>
                  <Link to="/login" className="btn btn-primary">Get Started – Login</Link>
                  <a href="#features" className="btn btn-ghost">Explore Features</a>
                </>
              ) : (
                <button onClick={() => nav("/interview-config")} className="btn btn-primary">Start Interview</button>
              )}
            </div>
          </div>

          <div style={{ display: "grid", placeItems: "center" }}>
            <img
              src="/assets/skillevaluation.png"
              alt="Skill Evaluation"
              className="hero-img"
            />
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" style={{ padding: "8px 24px 48px" }}>
        <h2 style={{ fontSize: 28, marginBottom: 16, textAlign: "center", maxWidth: 1100, margin: "0 auto 32px" }}>What you'll get</h2>
        <div className="features">
          <Feature tone="blue" title="Speak With Impact" body="Deliver your answers with clarity and confidence. Get instant feedback on your pace, tone, and word choice so you sound interview-ready." />
          <Feature tone="green" title="Master Eye Contact" body="Build trust through presence. Our AI coach guides your gaze and helps you maintain natural, engaging eye contact." />
          <Feature tone="purple" title="Smart Interview Questions" body="Practice the right way. Choose Communication, Programming, or Behavioural tracks and face tailored, real-world questions." />
          <Feature tone="orange" title="Your Personal Interview Report" body="No vague advice — just clear metrics. Receive a detailed breakdown of strengths, gaps, and actionable steps after every session." />
          <Feature tone="teal" title="Programming Readiness" body="Be tested like you will on the job. Tackle Python, React, and other technical prompts while explaining your approach under pressure." />
          <Feature tone="pink" title="Behavioural Edge" body="Ace HR rounds with confidence. Practice storytelling, problem solving, and culture-fit scenarios that matter to employers." />
          <Feature tone="blue" title="Track Your Progress" body="Don't just practice — improve. Monitor scores over time and see measurable growth with every interview." />
          <Feature tone="green" title="AI That Works For You" body="Think of it as your 24/7 interview coach: objective, reliable, and focused only on helping you succeed." />
        </div>
      </section>

      {/* How it works */}
      <section id="howitworks" style={{ padding: "0 24px 48px", maxWidth: 1100, margin: "0 auto" }}>
        <h2 style={{ fontSize: 28, marginBottom: 16, textAlign: "center" }}>How it works</h2>
        <ol style={{ color: "#4b5563", lineHeight: 1.8, maxWidth: 800, margin: "0 auto" }}>
          <li>Login (demo: <b>demo@example.com / demo123</b>).</li>
          <li>Select what to evaluate: <b>Communication</b>, <b>Programming</b> (e.g., Python/React), or <b>Behavioural</b>.</li>
          <li>Run the interview in the HUD: live captions, eye-contact coaching, WPM gauge.</li>
          <li>Get your report—review strengths, gaps, and action items.</li>
        </ol>
      </section>

      {/* Footer */}
      <footer id="faq" style={{ padding: "16px 24px", borderTop: "1px solid #eef2f7", background: "#fff", color: "#6b7280" }}>
        © {new Date().getFullYear()} Evaluate Yourself · Practice. Improve. Shine.
      </footer>
    </div>
  );
}

function Feature({ tone, title, body }) {
  return (
    <div className={`card ${tone}`}>
      <div className="card-title">{title}</div>
      <div className="card-body">{body}</div>
    </div>
  );
}