import { SignIn } from "@clerk/clerk-react";
import AuthShell from "../components/AuthShell";
import { defaultClerkAppearance } from "../utils/clerkAppearance";
import "../ui.css";

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      eyebrow="Account recovery"
      title="Reset access without guessing what comes next."
      subtitle="Enter your email, complete the verification step, and return to onboarding or your dashboard once the account is secure again."
      highlights={[
        { title: "Clear recovery flow", body: "Email verification and password reset in one guided path." },
        { title: "No lost progress", body: "Your interview history and reports stay attached to the same account." },
        { title: "Same secure workspace", body: "Once you’re back in, your interview setup, reports, and admin access stay connected to one account." },
      ]}
    >
      <p className="clerk-form-caption">
        Reset your password here. Once recovery is complete, Clerk brings you back into the standard sign-in flow.
      </p>
      <SignIn
        path="/forgot-password"
        routing="path"
        initialStep="forgot-password"
        oauthFlow="popup"
        forceRedirectUrl="/onboarding"
        fallbackRedirectUrl="/onboarding"
        signUpUrl="/register"
        appearance={defaultClerkAppearance}
      />
    </AuthShell>
  );
}
