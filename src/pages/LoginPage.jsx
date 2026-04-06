import { SignIn } from "@clerk/clerk-react";
import AuthShell from "../components/AuthShell";
import { defaultClerkAppearance } from "../utils/clerkAppearance";
import "../ui.css";

export default function LoginPage() {
  return (
    <AuthShell
      eyebrow="AI Interview Studio"
      title="Build interview confidence with realtime coaching."
      subtitle="Practice live sessions, get instant feedback, and walk into interviews with a clear plan to improve."
      highlights={[
        { title: "Live Signals", body: "Eye-contact, tone clarity, and filler tracking." },
        { title: "Scorecards", body: "Structured rubric across behavioral and role-specific skills." },
        { title: "Coach Notes", body: "Clear next-steps and focused practice drills after every session." },
      ]}
    >
      <p style={{ marginTop: 0, color: "#475569", fontSize: 13 }}>
        Sign in with email or SSO if your Clerk workspace has it enabled.
      </p>
      <SignIn
        path="/login"
        routing="path"
        oauthFlow="popup"
        forceRedirectUrl="/onboarding"
        fallbackRedirectUrl="/onboarding"
        signUpUrl="/register"
        appearance={defaultClerkAppearance}
      />
    </AuthShell>
  );
}
