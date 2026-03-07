import React from "react";
import { BrowserRouter, Routes, Route, Outlet, Navigate } from "react-router-dom";
import { ThemeProvider, CssBaseline, Box } from "@mui/material";

import PrivateRoute from "./components/PrivateRoute";
import AdminRoute from "./components/AdminRoute";
import ErrorBoundaryWrapper from "./components/ErrorBoundary";
import OnboardingGuard from "./components/OnboardingGuard";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import theme from "./theme/theme";

import LandingPage from "./pages/LandingPage.jsx";
import PricingPage from "./pages/PricingPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import Dashboard from "./pages/Dashboard";
import AdminLoginPage from "./pages/AdminLoginPage";
import OnboardingPage from "./pages/OnboardingPage";
import PreInterviewForm from "./pages/PreInterviewForm";
import InterviewSessionRoom from "./pages/InterviewSessionRoom";
import ReportPage from "./pages/ReportPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import InterviewsPage from "./pages/InterviewsPage";
import RealtimeTestPage from "./pages/RealtimeTestPage";
import AdminLayout from "./pages/admin/AdminLayout";
import AdminOverviewPage from "./pages/admin/AdminOverviewPage";
import AdminCandidatesPage from "./pages/admin/AdminCandidatesPage";
import AdminCandidateDetailPage from "./pages/admin/AdminCandidateDetailPage";
import AdminInterviewsPage from "./pages/admin/AdminInterviewsPage";
import AdminTrialsPage from "./pages/admin/AdminTrialsPage";
import AdminExportsPage from "./pages/admin/AdminExportsPage";
import AdminConfigPage from "./pages/admin/AdminConfigPage";
import AdminQuestionBankPage from "./pages/admin/AdminQuestionBankPage";

// Layout wrapper for authenticated pages with navbar
function MainLayout() {
  return (
    <Box
      sx={{
        minHeight: "100vh",
        backgroundColor: "background.default",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Navbar />
      <Box component="main" sx={{ flex: 1 }}>
        <Outlet />
      </Box>
      <Footer />
    </Box>
  );
}

function PublicLayout() {
  return (
    <Box
      sx={{
        minHeight: "100vh",
        backgroundColor: "background.default",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Box component="main" sx={{ flex: 1 }}>
        <Outlet />
      </Box>
      <Footer />
    </Box>
  );
}

function LandingLayout() {
  return (
    <Box
      sx={{
        minHeight: "100vh",
        backgroundColor: "background.default",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Box component="main" sx={{ flex: 1 }}>
        <Outlet />
      </Box>
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
          {/* Landing route without footer */}
          <Route element={<LandingLayout />}>
            <Route path="/" element={<LandingPage />} />
          </Route>

          {/* Public routes without navbar */}
          <Route element={<PublicLayout />}>
            <Route path="/pricing" element={<PricingPage />} />
            <Route path="/login/*" element={<LoginPage />} />
            <Route path="/register/*" element={<RegisterPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/admin" element={<Navigate to="/admin/login" replace />} />
            <Route path="/admin/login/*" element={<AdminLoginPage />} />
            <Route path="/test-realtime" element={<RealtimeTestPage />} />
            <Route path="/setup" element={<Navigate to="/interview-config" replace />} />
          </Route>

          {/* Auth-protected onboarding route (unguarded) */}
          <Route
            element={
              <PrivateRoute>
                <MainLayout />
              </PrivateRoute>
            }
          >
            <Route path="/onboarding" element={<OnboardingPage />} />
          </Route>

          <Route
            path="/admin/dashboard"
            element={
              <PrivateRoute signInUrl="/admin/login">
                <AdminRoute>
                  <AdminLayout />
                </AdminRoute>
              </PrivateRoute>
            }
          >
            <Route index element={<Navigate to="overview" replace />} />
            <Route path="overview" element={<AdminOverviewPage />} />
            <Route path="candidates" element={<AdminCandidatesPage />} />
            <Route path="candidates/:clerkUserId" element={<AdminCandidateDetailPage />} />
            <Route path="interviews" element={<AdminInterviewsPage />} />
            <Route path="question-bank" element={<AdminQuestionBankPage />} />
            <Route path="trials" element={<AdminTrialsPage />} />
            <Route path="exports" element={<AdminExportsPage />} />
            <Route path="config" element={<AdminConfigPage />} />
          </Route>

          {/* Auth-protected routes with navbar + onboarding completed */}
          <Route
            element={
              <PrivateRoute>
                <OnboardingGuard>
                  <MainLayout />
                </OnboardingGuard>
              </PrivateRoute>
            }
          >
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
            <Route path="/history" element={<Navigate to="/dashboard" replace />} />
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
                <OnboardingGuard>
                  <ErrorBoundaryWrapper>
                    <InterviewSessionRoom />
                  </ErrorBoundaryWrapper>
                </OnboardingGuard>
              </PrivateRoute>
            }
          />

          <Route
            path="/interview/session/:sessionId"
            element={
              <PrivateRoute>
                <OnboardingGuard>
                  <ErrorBoundaryWrapper>
                    <InterviewSessionRoom />
                  </ErrorBoundaryWrapper>
                </OnboardingGuard>
              </PrivateRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}
