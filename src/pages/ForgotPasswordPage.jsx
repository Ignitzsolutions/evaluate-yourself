import React from "react";
import { Link } from "react-router-dom";
import { Typography, Button, Box } from "@mui/material";
import AuthShell from "../components/AuthShell";
import "../ui.css";

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      eyebrow="Password Recovery"
      title="Reset your password"
      subtitle="We're working on self-service password reset. For now, please contact your administrator."
    >
      <Typography variant="body2" sx={{ color: "#475569", mb: 3 }}>
        If you forgot your password, please contact an administrator to reset it for you.
        Self-service password reset via email will be available soon.
      </Typography>
      <Box sx={{ textAlign: "center" }}>
        <Button component={Link} to="/login" variant="outlined" sx={{ mr: 1 }}>
          Back to Sign In
        </Button>
      </Box>
    </AuthShell>
  );
}
