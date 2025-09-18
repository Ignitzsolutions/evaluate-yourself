import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "../ui.css";

export default function LoginPage() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    const res = login(email, password);
    if (res.success) nav("/dashboard"); else setError(res.message);
  };

  return (
    <div>
      {/* Glossy header */}
      <header className="glossy-header">
        <div className="glossy-inner">
          {/* Left: Logo */}
          <div className="brand-section">
            <Link to="/" style={{ display: "flex", alignItems: "center", gap: "8px", textDecoration: "none", color: "inherit" }}>
              <img 
                src="/assets/logo.png" 
                alt="Evaluate Yourself Logo"
                style={{width:36, height:36, borderRadius:12}}
              />
              <strong>Evaluate Yourself</strong>
            </Link>
          </div>

          {/* Center: Empty for login page */}
          <div></div>

          {/* Right: Demo info */}
          <div style={{color:"#6b7280", fontSize:"14px"}}>
            Demo login → <b>demo@example.com / demo123</b>
          </div>
        </div>
      </header>

      {/* Centered auth card */}
      <main className="auth-shell">
        <section className="auth-card">
          {/* left hero side */}
          <div className="auth-hero">
            <div>
              <h1>Practice smarter. Interview better.</h1>
              <p>Real-time captions, eye-contact coaching and a clear report after every session.</p>
              <img
                src="/assets/skillevaluation.png"
                alt="Skill Evaluation"
                style={{width:"90%",maxWidth:520,borderRadius:16, boxShadow:"0 16px 40px rgba(30,136,229,.25)", display:"block", margin:"18px auto 0"}}
              />
            </div>
          </div>

          {/* right form side */}
          <form className="auth-form" onSubmit={handleSubmit}>
            <h2 style={{margin:0, fontSize:22}}>Login</h2>
            <input
              className="input"
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e)=>setEmail(e.target.value)}
              required
            />
            <input
              className="input"
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e)=>setPassword(e.target.value)}
              required
            />
            {error && <div style={{color:"crimson", fontSize:13, textAlign:"center"}}>{error}</div>}
            <button className="btn btn-primary btn-lg" type="submit">Sign in</button>
            <div className="hint">Use demo: <b>demo@example.com / demo123</b></div>
          </form>
        </section>
      </main>
    </div>
  );
}