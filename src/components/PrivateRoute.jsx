import { RedirectToSignIn, useAuth } from "@clerk/clerk-react";
import { isDevAuthBypassEnabled } from "../utils/devAuthBypass";

export default function PrivateRoute({ children, signInUrl = "/login" }) {
  const { isLoaded, isSignedIn } = useAuth();
  if (isDevAuthBypassEnabled()) return children;
  if (!isLoaded) return null;
  if (isSignedIn) return children;
  return <RedirectToSignIn signInUrl={signInUrl} />;
}
