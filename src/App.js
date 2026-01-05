import React from "react";
import { BrowserRouter, Routes, Route, Outlet } from "react-router-dom";
import { ThemeProvider, CssBaseline, Box } from "@mui/material";
import { AuthProvider } from "./context/AuthContext";
import PrivateRoute from "./components/PrivateRoute";
import Navbar from "./components/Navbar";
import theme from "./theme/theme";

import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import Dashboard from "./pages/Dashboard";
import PreInterviewForm from "./pages/PreInterviewForm";
import InterviewHUD from "./pages/InterviewHUD";
import ReportPage from "./pages/ReportPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import HistoryPage from "./pages/HistoryPage";
import InterviewsPage from "./pages/InterviewsPage";

// Layout wrapper for authenticated pages with navbar
function MainLayout() {
  return (
    <Box sx={{ minHeight: "100vh", backgroundColor: "background.default" }}>
      <Navbar />
      <Outlet />
    </Box>
  );
}

export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Public routes without navbar */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />

            {/* Auth-protected routes with navbar */}
            <Route
              element={
                <PrivateRoute>
                  <MainLayout />
                </PrivateRoute>
              }
            >
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/analytics" element={<AnalyticsPage />} />
              <Route path="/history" element={<HistoryPage />} />
              <Route path="/interviews" element={<InterviewsPage />} />
              <Route path="/interview-cfig" element={<PreInterviewForm />} />
              <Route path="/interview-config" element={<PreInterviewForm />} />
              <Route path="/interview-hud" element={<InterviewHUD />} />
              <Route path="/interview/:type" element={<InterviewHUD />} />
              <Route path="/report" element={<ReportPage />} />
              <Route path="/report/:sessionId" element={<ReportPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
