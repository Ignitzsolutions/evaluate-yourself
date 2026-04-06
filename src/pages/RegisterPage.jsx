import { SignUp } from "@clerk/clerk-react";
import AuthShell from "../components/AuthShell";
import { defaultClerkAppearance } from "../utils/clerkAppearance";
import "../ui.css";

export default function RegisterPage() {
  return (
    <AuthShell
      eyebrow="Create Your Workspace"
      title="Start practicing interviews with a setup that actually feels serious."
      subtitle="Create your account, complete onboarding once, and use the same workspace for live interviews, reports, and admin access."
      highlights={[
        { title: "One Workspace", body: "Your interview history, reports, and account settings stay in one place." },
        { title: "Structured Practice", body: "Choose technical, behavioral, or 360 interviews with a consistent setup flow." },
        { title: "Clear Output", body: "Finish each session with a report, evidence, and coaching priorities." },
      ]}
    >
      <p style={{ marginTop: 0, color: "#475569", fontSize: 13 }}>
        Create your account with email or SSO if your Clerk workspace has it enabled.
      </p>
      <SignUp
        path="/register"
        routing="path"
        oauthFlow="popup"
        fallbackRedirectUrl="/onboarding"
        forceRedirectUrl="/onboarding"
        signInUrl="/login"
        appearance={defaultClerkAppearance}
      />
    </AuthShell>
  );
}
