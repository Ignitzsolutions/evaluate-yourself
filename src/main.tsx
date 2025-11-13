import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ClerkProvider } from "@clerk/clerk-react";
import App from "./App.tsx";
import "./index.css";

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!PUBLISHABLE_KEY) {
  // Show error in UI instead of blank screen
  const root = document.getElementById("root");
  if (root) {
    root.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: center; min-height: 100vh; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif; padding: 20px; background: #f9fafb;">
        <div style="text-align: center; max-width: 600px; background: white; padding: 40px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <h1 style="color: #dc2626; margin-bottom: 16px; font-size: 24px; font-weight: 600;">Missing Clerk Publishable Key</h1>
          <p style="color: #6b7280; margin-bottom: 24px; line-height: 1.6;">
            Please add <code style="background: #f3f4f6; padding: 2px 8px; border-radius: 4px; font-family: 'Courier New', monospace;">VITE_CLERK_PUBLISHABLE_KEY</code> to your <code style="background: #f3f4f6; padding: 2px 8px; border-radius: 4px; font-family: 'Courier New', monospace;">.env</code> or <code style="background: #f3f4f6; padding: 2px 8px; border-radius: 4px; font-family: 'Courier New', monospace;">.env.local</code> file.
          </p>
          <div style="background: #f9fafb; padding: 16px; border-radius: 6px; margin-bottom: 24px; text-align: left;">
            <p style="color: #374151; margin-bottom: 8px; font-weight: 500;">Example .env file:</p>
            <code style="color: #059669; font-family: 'Courier New', monospace; font-size: 14px;">
              VITE_CLERK_PUBLISHABLE_KEY=pk_test_your_key_here
            </code>
          </div>
          <p style="color: #6b7280; font-size: 14px; margin-bottom: 8px;">
            The key should start with <code style="background: #f3f4f6; padding: 2px 6px; border-radius: 4px;">pk_test_</code> or <code style="background: #f3f4f6; padding: 2px 6px; border-radius: 4px;">pk_live_</code>
          </p>
          <p style="color: #6b7280; font-size: 14px; margin-top: 16px;">
            <strong>Important:</strong> After adding the key, you must <strong>restart your dev server</strong> with <code style="background: #f3f4f6; padding: 2px 6px; border-radius: 4px;">npm run dev</code>
          </p>
          <p style="color: #dc2626; font-size: 12px; margin-top: 16px; padding: 12px; background: #fef2f2; border-radius: 4px;">
            Check the browser console (F12) for more details.
          </p>
        </div>
      </div>
    `;
  }
  throw new Error("Missing Clerk Publishable Key");
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ClerkProvider publishableKey={PUBLISHABLE_KEY} afterSignOutUrl="/">
      <App />
    </ClerkProvider>
  </StrictMode>
);
