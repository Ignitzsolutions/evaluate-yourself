import React from "react";
import ReactDOM from "react-dom/client";
import { ClerkProvider } from "@clerk/clerk-react";
import "./index.css";
import App from "./App";

const clerkPubKey = process.env.REACT_APP_CLERK_PUBLISHABLE_KEY;
console.log("Clerk Key:", process.env.REACT_APP_CLERK_PUBLISHABLE_KEY);

const root = ReactDOM.createRoot(document.getElementById("root"));

root.render(
  <React.StrictMode>
    <ClerkProvider publishableKey={clerkPubKey}>
      <App />
    </ClerkProvider>
  </React.StrictMode>
);