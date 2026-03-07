// import React, { useState } from "react";
// import { useNavigate, Link } from "react-router-dom";
// import { useAuth } from "../context/AuthContext";
// import "../ui.css";

// export default function RegisterPage() {
//     const { login } = useAuth(); // you can replace with API later
//     const nav = useNavigate();

//     const [email, setEmail] = useState("");
//     const [password, setPassword] = useState("");
//     const [confirm, setConfirm] = useState("");
//     const [error, setError] = useState(null);

//     const handleSubmit = (e) => {
//         e.preventDefault();
//         if (password !== confirm) {
//             setError("Passwords do not match");
//             return;
//         }
//         // mock success → auto login and redirect
//         const u = { email };
//         localStorage.setItem("authUser", JSON.stringify(u));
//         login(email, password);
//         nav("/dashboard");
//     };

//     return (
//         <div>
//             {/* Glossy header */}
//             <header className="glossy-header">
//                 <div className="glossy-inner">
//                     {/* Left: Logo */}
//                     <div className="brand-section">
//                         <Link to="/" style={{ display: "flex", alignItems: "center", gap: "8px", textDecoration: "none", color: "inherit" }}>
//                             <img
//                                 src="/assets/logo.png"
//                                 alt="Evaluate Yourself Logo"
//                                 style={{ width: 36, height: 36, borderRadius: 12 }}
//                             />
//                             <strong>Evaluate Yourself</strong>
//                         </Link>
//                     </div>

//                     <div style={{ color: "#6b7280", fontSize: "14px", fontWeight: 600 }}>

//                     </div>

//                     <Link to="/login" className="btn btn-primary" style={{
//                         textDecoration: "none",
//                         fontSize:"14px",
//                         padding:"8px 14px",
//                         transition: "all 0.3s ease-in-out"
//                     }}>Login</Link>
//                 </div>
//             </header>

//             {/* Centered auth card */}
//             <main className="auth-shell">
//                 <section className="auth-card">
//                     {/* left hero side */}
//                     <div className="auth-hero">
//                         <div>
//                             <h1>Build your confidence.</h1>
//                             <p>Track your skills, improve posture, speech, and eye contact with AI coaching.</p>
//                             <img
//                                 src="/assets/skillevaluation.png"
//                                 alt="Skill Evaluation"
//                                 style={{
//                                     width: "90%", maxWidth: 520, borderRadius: 16,
//                                     boxShadow: "0 16px 40px rgba(30,136,229,.25)",
//                                     display: "block", margin: "18px auto 0"
//                                 }}
//                             />
//                         </div>
//                     </div>

//                     {/* right form side */}
//                     <form className="auth-form" onSubmit={handleSubmit}>
//                         <h2 style={{ margin: 0, fontSize: 22 }}>Register</h2>
//                         <input
//                             className="input"
//                             type="email"
//                             placeholder="Email"
//                             value={email}
//                             onChange={(e) => setEmail(e.target.value)}
//                             required
//                         />
//                         <input
//                             className="input"
//                             type="password"
//                             placeholder="Create password"
//                             value={password}
//                             onChange={(e) => setPassword(e.target.value)}
//                             required
//                             minLength={6}
//                         />
//                         <input
//                             className="input"
//                             type="password"
//                             placeholder="Confirm password"
//                             value={confirm}
//                             onChange={(e) => setConfirm(e.target.value)}
//                             required
//                             minLength={6}
//                         />

//                         {error && <div className="hint" style={{ color: "crimson", fontWeight: 600 }}>{error}</div>}

//                         <button className="btn btn-primary btn-lg" type="submit">Create account</button>

//                         <div className="hint">
//                             Already have an account? <Link to="/login" style={{ textDecoration: "none", color: "var(--brand)", fontWeight: 700 }}>Login</Link>
//                         </div>
//                     </form>
//                 </section>
//             </main>
//         </div>
//     );
// }
import { SignUp } from "@clerk/clerk-react";

export default function RegisterPage() {
  return (
    <SignUp
      path="/register"
      routing="path"
      oauthFlow="popup"
      fallbackRedirectUrl="/onboarding"
      forceRedirectUrl="/onboarding"
      signInUrl="/login"
    />
  );
}
