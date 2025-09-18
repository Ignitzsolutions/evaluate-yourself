import React from "react";
import { Button } from "@mui/material";
import { Logout } from "@mui/icons-material";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

export default function LogoutButton({ variant = "outlined", size = "small" }) {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
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