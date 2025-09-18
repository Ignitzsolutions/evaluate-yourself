import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import PrivateRoute from "./components/PrivateRoute";

import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import Dashboard from "./pages/Dashboard";
import PreInterviewForm from "./pages/PreInterviewForm";
import InterviewHUD from "./pages/InterviewHUD";
import ReportPage from "./pages/ReportPage";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />

          {/* Auth-protected */}
          <Route
            path="/dashboard"
            element={
              <PrivateRoute>
                <Dashboard />
              </PrivateRoute>
            }
          />
          <Route
            path="/interview-cfig"
            element={
              <PrivateRoute>
                <PreInterviewForm />
              </PrivateRoute>
            }
          />
          <Route
            path="/interview-config"
            element={
              <PrivateRoute>
                <PreInterviewForm />
              </PrivateRoute>
            }
          />
          <Route
            path="/interview-hud"
            element={
              <PrivateRoute>
                <InterviewHUD />
              </PrivateRoute>
            }
          />
          <Route
            path="/interview/:type"
            element={
              <PrivateRoute>
                <InterviewHUD />
              </PrivateRoute>
            }
          />
          <Route
            path="/report"
            element={
              <PrivateRoute>
                <ReportPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/report/:sessionId"
            element={
              <PrivateRoute>
                <ReportPage />
              </PrivateRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}