import React from "react";
import { BrowserRouter, Routes, Route, Outlet, Navigate } from "react-router-dom";
import { ThemeProvider, CssBaseline, Box } from "@mui/material";

import PrivateRoute from "./components/PrivateRoute";
import ErrorBoundaryWrapper from "./components/ErrorBoundary";
import Navbar from "./components/Navbar";
import theme from "./theme/theme";

import LandingPage from "./pages/LandingPage.jsx";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import Dashboard from "./pages/Dashboard";
import PreInterviewForm from "./pages/PreInterviewForm";
import InterviewSessionRoom from "./pages/InterviewSessionRoom";
import ReportPage from "./pages/ReportPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import HistoryPage from "./pages/HistoryPage";
import InterviewsPage from "./pages/InterviewsPage";
import RealtimeTestPage from "./pages/RealtimeTestPage";

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

      <BrowserRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <Routes>
          {/* Public routes without navbar */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/test-realtime" element={<RealtimeTestPage />} />
          <Route path="/setup" element={<Navigate to="/interview-config" replace />} />

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
            <Route path="/interview-config" element={<PreInterviewForm />} />
            <Route path="/report" element={<ReportPage />} />
            <Route path="/report/:sessionId" element={<ReportPage />} />
          </Route>

          {/* Interview session routes - full screen, no navbar */}
          <Route
            path="/interview"
            element={
              <PrivateRoute>
                <Navigate to="/interviews" replace />
              </PrivateRoute>
            }
          />

          <Route
            path="/interview/:type"
            element={
              <PrivateRoute>
                <ErrorBoundaryWrapper>
                  <InterviewSessionRoom />
                </ErrorBoundaryWrapper>
              </PrivateRoute>
            }
          />

          <Route
            path="/interview/session/:sessionId"
            element={
              <PrivateRoute>
                <ErrorBoundaryWrapper>
                  <InterviewSessionRoom />
                </ErrorBoundaryWrapper>
              </PrivateRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}