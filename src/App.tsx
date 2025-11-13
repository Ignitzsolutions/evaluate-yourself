import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { SignedIn, SignedOut, RedirectToSignIn, SignIn, SignUp } from "@clerk/clerk-react";
import Landing from "./pages/Landing";
import Dashboard from "./pages/Dashboard";
import InterviewConfigure from "./pages/InterviewConfigure";
import InterviewSession from "./pages/InterviewSession";
import Reports from "./pages/Reports";
import ReportDetail from "./pages/ReportDetail";
import Resume from "./pages/Resume";
import SelfInsightLanding from "./pages/SelfInsightLanding";
import PersonalityAssessment from "./pages/PersonalityAssessment";
import PersonalityReportsList from "./pages/PersonalityReportsList";
import PersonalityReportDetail from "./pages/PersonalityReportDetail";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route
            path="/sign-in/*"
            element={
              <div className="min-h-screen flex flex-col items-center justify-center bg-background">
                <div className="mb-10">
                  <img
                    src="/logo.png"
                    alt="Evaluate Yourself"
                    className="h-24 w-auto"
                  />
                </div>
                <SignIn
                  appearance={{
                    elements: {
                      rootBox: "mx-auto",
                      card: "shadow-lg",
                    },
                    variables: {
                      colorPrimary: "#FF6B35",
                      fontFamily: "Avenir, sans-serif",
                    },
                  }}
                  routing="path"
                  path="/sign-in"
                  signUpUrl="/sign-up"
                  fallbackRedirectUrl="/dashboard"
                />
              </div>
            }
          />
          <Route
            path="/sign-up/*"
            element={
              <div className="min-h-screen flex flex-col items-center justify-center bg-background">
                <div className="mb-10">
                  <img
                    src="/logo.png"
                    alt="Evaluate Yourself"
                    className="h-24 w-auto"
                  />
                </div>
                <SignUp
                  appearance={{
                    elements: {
                      rootBox: "mx-auto",
                      card: "shadow-lg",
                    },
                    variables: {
                      colorPrimary: "#FF6B35",
                      fontFamily: "Avenir, sans-serif",
                    },
                  }}
                  routing="path"
                  path="/sign-up"
                  signInUrl="/sign-in"
                  fallbackRedirectUrl="/dashboard"
                />
              </div>
            }
          />
          <Route
            path="/dashboard"
            element={
              <>
                <SignedIn>
                  <Dashboard />
                </SignedIn>
                <SignedOut>
                  <RedirectToSignIn redirectUrl={window.location.pathname} />
                </SignedOut>
              </>
            }
          />
          <Route
            path="/interview/configure"
            element={
              <>
                <SignedIn>
                  <InterviewConfigure />
                </SignedIn>
                <SignedOut>
                  <RedirectToSignIn redirectUrl={window.location.pathname} />
                </SignedOut>
              </>
            }
          />
          <Route
            path="/interview/session"
            element={
              <>
                <SignedIn>
                  <InterviewSession />
                </SignedIn>
                <SignedOut>
                  <RedirectToSignIn redirectUrl={window.location.pathname} />
                </SignedOut>
              </>
            }
          />
          <Route
            path="/reports"
            element={
              <>
                <SignedIn>
                  <Reports />
                </SignedIn>
                <SignedOut>
                  <RedirectToSignIn redirectUrl={window.location.pathname} />
                </SignedOut>
              </>
            }
          />
          <Route
            path="/reports/:id"
            element={
              <>
                <SignedIn>
                  <ReportDetail />
                </SignedIn>
                <SignedOut>
                  <RedirectToSignIn redirectUrl={window.location.pathname} />
                </SignedOut>
              </>
            }
          />
          <Route
            path="/resume"
            element={
              <>
                <SignedIn>
                  <Resume />
                </SignedIn>
                <SignedOut>
                  <RedirectToSignIn redirectUrl={window.location.pathname} />
                </SignedOut>
              </>
            }
          />
          <Route
            path="/self-insight"
            element={
              <>
                <SignedIn>
                  <SelfInsightLanding />
                </SignedIn>
                <SignedOut>
                  <RedirectToSignIn redirectUrl={window.location.pathname} />
                </SignedOut>
              </>
            }
          />
          <Route
            path="/self-insight/assessment"
            element={
              <>
                <SignedIn>
                  <PersonalityAssessment />
                </SignedIn>
                <SignedOut>
                  <RedirectToSignIn redirectUrl={window.location.pathname} />
                </SignedOut>
              </>
            }
          />
          <Route
            path="/self-insight/reports"
            element={
              <>
                <SignedIn>
                  <PersonalityReportsList />
                </SignedIn>
                <SignedOut>
                  <RedirectToSignIn redirectUrl={window.location.pathname} />
                </SignedOut>
              </>
            }
          />
          <Route
            path="/self-insight/reports/:id"
            element={
              <>
                <SignedIn>
                  <PersonalityReportDetail />
                </SignedIn>
                <SignedOut>
                  <RedirectToSignIn redirectUrl={window.location.pathname} />
                </SignedOut>
              </>
            }
          />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
);

export default App;
