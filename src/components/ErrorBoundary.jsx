import React from "react";
import { Box, Typography, Button } from "@mui/material";
import { ErrorOutline, Refresh, Home } from "@mui/icons-material";
import { useNavigate } from "react-router-dom";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
    this.setState({
      error: error,
      errorInfo: errorInfo,
    });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <Box
          sx={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: 4,
            background: "#ffffff",
          }}
        >
          <ErrorOutline sx={{ fontSize: 64, color: "#ef4444", mb: 2 }} />
          <Typography variant="h5" sx={{ fontWeight: 600, mb: 1, color: "#111827" }}>
            Something went wrong
          </Typography>
          <Typography
            variant="body2"
            sx={{ color: "#6b7280", mb: 4, textAlign: "center", maxWidth: "500px" }}
          >
            We encountered an unexpected error. Please try refreshing the page or going back to the dashboard.
          </Typography>
          <Box sx={{ display: "flex", gap: 2 }}>
            <Button
              variant="contained"
              startIcon={<Refresh />}
              onClick={this.handleReset}
              sx={{
                background: "rgb(251,101,30)",
                "&:hover": { background: "rgb(251,101,30)", opacity: 0.9 },
              }}
            >
              Try Again
            </Button>
            <Button
              variant="outlined"
              startIcon={<Home />}
              onClick={() => {
                this.handleReset();
                this.props.navigate?.("/dashboard");
              }}
            >
              Go to Dashboard
            </Button>
          </Box>
          {process.env.NODE_ENV === "development" && this.state.error && (
            <Box
              sx={{
                mt: 4,
                p: 2,
                background: "#f5f5f5",
                borderRadius: 1,
                maxWidth: "800px",
                width: "100%",
              }}
            >
              <Typography variant="caption" sx={{ fontFamily: "monospace", fontSize: "11px" }}>
                {this.state.error.toString()}
                {this.state.errorInfo?.componentStack}
              </Typography>
            </Box>
          )}
        </Box>
      );
    }

    return this.props.children;
  }
}

// Wrapper component to use hooks
export default function ErrorBoundaryWrapper({ children }) {
  const navigate = useNavigate();
  return <ErrorBoundary navigate={navigate}>{children}</ErrorBoundary>;
}
