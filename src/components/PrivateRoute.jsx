import { SignedIn, SignedOut, RedirectToSignIn } from "@clerk/clerk-react";

export default function PrivateRoute({ children }) {
  return (
    <>
      <SignedIn>
        {children}
      </SignedIn>

      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>
    </>
  );
}
