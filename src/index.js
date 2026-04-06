import React from "react";
import ReactDOM from "react-dom/client";
import { ClerkProvider } from "@clerk/clerk-react";
import "./index.css";
import App from "./App";

const STALE_CLERK_PUBLISHABLE_KEY = "pk_test_ZW5nYWdpbmctZ2F6ZWxsZS01Mi5jbGVyay5hY2NvdW50cy5kZXYk";
const FALLBACK_CLERK_PUBLISHABLE_KEY = "pk_test_cmVndWxhci1nYXRvci00LmNsZXJrLmFjY291bnRzLmRldiQ";

// CRA build uses REACT_APP_* vars. We also accept NEXT_PUBLIC_* as a fallback to reduce config mistakes.
const configuredClerkPubKey = (
  process.env.REACT_APP_CLERK_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ||
  ""
).trim();
const clerkPubKey = (
  configuredClerkPubKey === STALE_CLERK_PUBLISHABLE_KEY
    ? FALLBACK_CLERK_PUBLISHABLE_KEY
    : configuredClerkPubKey
).trim();

const root = ReactDOM.createRoot(document.getElementById("root"));

if (!clerkPubKey || clerkPubKey.trim() === "") {
  root.render(
    <div
      style={{
        padding: 24,
        maxWidth: 560,
        margin: "40px auto",
        fontFamily: "system-ui, sans-serif",
        background: "#fef3c7",
        borderRadius: 8,
        border: "1px solid #f59e0b",
      }}
    >
      <h2 style={{ margin: "0 0 12px 0", color: "#92400e" }}>Clerk key not configured</h2>
      <p style={{ margin: 0, color: "#78350f", lineHeight: 1.5 }}>
        Add <code style={{ background: "#fff", padding: "2px 6px", borderRadius: 4 }}>REACT_APP_CLERK_PUBLISHABLE_KEY</code>
        {" "}to your <strong>.env</strong> in the project root (or use{" "}
        <code style={{ background: "#fff", padding: "2px 6px", borderRadius: 4 }}>NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY</code>
        {" "}as a compatibility fallback), then restart the dev server (<code>npm start</code>).
      </p>
      <p style={{ margin: "12px 0 0 0", fontSize: 14, color: "#78350f" }}>
        Get your key at{" "}
        <a href="https://dashboard.clerk.com/last-active?path=api-keys" target="_blank" rel="noopener noreferrer">
          dashboard.clerk.com → API Keys
        </a>
        .
      </p>
    </div>
  );
} else {
  root.render(
    <React.StrictMode>
      <ClerkProvider publishableKey={clerkPubKey.trim()}>
        <App />
      </ClerkProvider>
    </React.StrictMode>
  );
}
