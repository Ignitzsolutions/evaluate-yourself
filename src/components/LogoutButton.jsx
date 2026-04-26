import React from "react";
import { Button } from "@mui/material";
import { Logout } from "@mui/icons-material";
import { useClerk } from "@clerk/clerk-react";
import { useNavigate } from "react-router-dom";

export default function LogoutButton({ variant = "outlined", size = "small" }) {
  const { signOut } = useClerk();
  const navigate = useNavigate();

  const handleLogout = () => {
    signOut();
    navigate("/");
  };

  return (
    <Button
      variant={variant}
      size={size}
      startIcon={<Logout />}
      onClick={handleLogout}
      color="error"
    >
      Logout
    </Button>
  );
}
