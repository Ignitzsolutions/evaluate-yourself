// import React, { useState } from "react";
// import { useNavigate, Link } from "react-router-dom";
// import { useAuth } from "../context/AuthContext";
// import "../ui.css";

// export default function LoginPage() {
//   const { login } = useAuth();
//   const nav = useNavigate();
//   const [email, setEmail] = useState("");
//   const [password, setPassword] = useState("");
//   const [error, setError] = useState(null);

//   const handleSubmit = (e) => {
//     e.preventDefault();
//     const res = login(email, password);
//     if (res.success) nav("/"); else setError(res.message);
//   };

//   return (
//     <div>
//       {/* Glossy header */}
//       <header className="glossy-header">
//         <div className="glossy-inner">
//           {/* Left: Logo */}
//           <div className="brand-section">
//             <Link to="/" style={{ display: "flex", alignItems: "center", gap: "8px", textDecoration: "none", color: "inherit" }}>
//               <img
//                 src="/assets/logo.png"
//                 alt="Evaluate Yourself Logo"
//                 style={{ width: 36, height: 36, borderRadius: 12 }}
//               />
//               <strong>Evaluate Yourself</strong>
//             </Link>
//           </div>

//           {/* Center: Empty for login page */}
//           <div></div>

//           {/* Right: Demo info */}
//           <div style={{ color: "#6b7280", fontSize: "14px" }}>
//             Demo login → <b>demo@example.com / demo123</b>
//           </div>
//         </div>
//       </header>

//       {/* Centered auth card */}
//       <main className="auth-shell">
//         <section className="auth-card">
//           {/* left hero side */}
//           <div className="auth-hero">
//             <div>
//               <h1>Practice smarter. Interview better.</h1>
//               <p>Real-time captions, eye-contact coaching and a clear report after every session.</p>
//               <img
//                 src="/assets/skillevaluation.png"
//                 alt="Skill Evaluation"
//                 style={{ width: "90%", maxWidth: 520, borderRadius: 16, boxShadow: "0 16px 40px rgba(30,136,229,.25)", display: "block", margin: "18px auto 0" }}
//               />
//             </div>
//           </div>

//           {/* right form side */}
//           <form className="auth-form" onSubmit={handleSubmit}>
//             <h2 style={{ margin: 0, fontSize: 22 }}>Login</h2>
//             <input
//               className="input"
//               type="email"
//               placeholder="Email"
//               value={email}
//               onChange={(e) => setEmail(e.target.value)}
//               required
//             />
//             <input
//               className="input"
//               type="password"
//               placeholder="Password"
//               value={password}
//               onChange={(e) => setPassword(e.target.value)}
//               required
//             />
//             {error && <div style={{ color: "crimson", fontSize: 13, textAlign: "center" }}>{error}</div>}
//             <button className="btn btn-primary btn-lg" type="submit">Sign in</button>
//             <div className="hint" style={{ marginTop: "10px" }}>
//               Don’t have an account?{" "}
//               <Link to="/register" style={{ textDecoration: "none", color: "var(--brand)", fontWeight: 700 }}>
//                 Register
//               </Link>
//             </div>
//             <div className="hint">
//               <Link to="/forgot-password" style={{ textDecoration: "none", color: "var(--brand)", fontWeight: 700 }}>
//                 Forgot password?
//               </Link>
//             </div>
//             <div className="hint">Use demo: <b>demo@example.com / demo123</b></div>
//           </form>
//         </section>
//       </main>
//     </div>
//   );
// }
import { SignIn } from "@clerk/clerk-react";
import "../ui.css";

export default function LoginPage() {
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
              <div className="clerk-brand-sub">AI Interview Studio</div>
            </div>
          </div>

          <h1>Build interview confidence with realtime coaching.</h1>
          <p>
            Practice live sessions, get instant feedback, and walk into interviews with a clear plan
            to improve.
          </p>

          <div className="clerk-info-grid">
            <div className="clerk-info-card">
              <div className="clerk-info-title">Live Signals</div>
              <div className="clerk-info-body">Eye-contact, tone clarity, and filler tracking.</div>
            </div>
            <div className="clerk-info-card">
              <div className="clerk-info-title">Scorecards</div>
              <div className="clerk-info-body">Structured rubric across behavioral + role skills.</div>
            </div>
            <div className="clerk-info-card">
              <div className="clerk-info-title">Coach Notes</div>
              <div className="clerk-info-body">Next-steps and practice drills personalized to you.</div>
            </div>
          </div>
        </div>

        <div className="clerk-form-wrap">
          <p style={{ marginTop: 0, color: "#475569", fontSize: 13 }}>
            Sign in with email or SSO (Google/enterprise, if enabled in Clerk).
          </p>
          <SignIn
            path="/login"
            routing="path"
            oauthFlow="popup"
            forceRedirectUrl="/onboarding"
            fallbackRedirectUrl="/onboarding"
            signUpUrl="/register"
            appearance={{
              variables: {
                colorPrimary: "#2563eb",
                colorBackground: "#ffffff",
                colorText: "#0f172a",
                fontFamily: "Manrope, system-ui, sans-serif",
                borderRadius: "14px",
              },
              elements: {
                card: "clerk-card",
                headerTitle: "clerk-header-title",
                headerSubtitle: "clerk-header-subtitle",
                socialButtonsBlockButton: "clerk-social-button",
                formButtonPrimary: "clerk-primary-button",
                footerActionLink: "clerk-footer-link",
              },
            }}
          />
        </div>
      </section>
    </div>
  );
}
