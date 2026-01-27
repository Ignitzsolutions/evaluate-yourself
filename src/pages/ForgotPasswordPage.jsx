// import React, { useState } from "react";
// import { Link } from "react-router-dom";
// import "../ui.css";

// export default function ForgotPasswordPage() {
//     const [email, setEmail] = useState("");
//     const [sent, setSent] = useState(false);
//     const [error, setError] = useState(null);

//     const handleSubmit = (e) => {
//         e.preventDefault();
//         if (!email.includes("@")) {
//             setError("Enter a valid email");
//             return;
//         }

//         // Mock success (replace with API call later)
//         setSent(true);
//         setError(null);
//     };

//     return (
//         <div>
//             {/* Glossy header */}
//             <header className="glossy-header">
//                 <div className="glossy-inner">
//                     <div className="brand-section">
//                         <Link
//                             to="/"
//                             style={{ display: "flex", alignItems: "center", gap: "8px", textDecoration: "none", color: "inherit" }}
//                         >
//                             <img
//                                 src="/assets/logo.png"
//                                 alt="Evaluate Yourself Logo"
//                                 style={{ width: 36, height: 36, borderRadius: 12 }}
//                             />
//                             <strong>Evaluate Yourself</strong>
//                         </Link>
//                     </div>
//                     <div></div>
                    
//                 </div>
//             </header>

//             {/* Centered auth card */}
//             <main className="auth-shell">
//                 <section className="auth-card">
//                     {/* Hero side */}
//                     <div className="auth-hero">
//                         <div>
//                             <h1>Reset. Recover. Resume.</h1>
//                             <p>We’ll send a password reset link to your inbox.</p>
//                         </div>
//                     </div>

//                     {/* Form side */}
//                     <form className="auth-form" onSubmit={handleSubmit}>
//                         <h2 style={{ margin: 0, fontSize: 22 }}>Forgot Password</h2>

//                         <input
//                             className="input"
//                             type="email"
//                             placeholder="Enter your email"
//                             value={email}
//                             onChange={(e) => setEmail(e.target.value)}
//                             required
//                         />

//                         {error && (
//                             <div className="hint" style={{ color: "crimson", fontWeight: 600 }}>
//                                 {error}
//                             </div>
//                         )}

//                         {sent ? (
//                             <div className="hint" style={{ color: "green", fontWeight: 700 }}>
//                                 Reset link sent! Check your inbox.
//                             </div>
//                         ) : (
//                             <button className="btn btn-primary btn-lg" type="submit">
//                                 Send reset link
//                             </button>
//                         )}

//                         <div className="hint" style={{ marginTop: 12 }}>
//                             Remembered password?{" "}
//                             <Link to="/login" style={{ color: "var(--brand)", fontWeight: 700 }}>
//                                 Login
//                             </Link>
//                         </div>
//                     </form>
//                 </section>
//             </main>
//         </div>
//     );
// }
import { SignIn } from "@clerk/clerk-react";

export default function ForgotPasswordPage() {
  return <SignIn initialStep="forgot-password" />;
}