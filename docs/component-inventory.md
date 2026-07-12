# Component Inventory

## Shell And Routing

- `src/App.js`: route tree, layouts, app shell, public/auth/protected route boundaries.
- `src/components/Navbar.jsx`: main authenticated navigation.
- `src/components/Footer.jsx`: public/app footer.
- `src/components/PrivateRoute.jsx`: auth gate.
- `src/components/OnboardingGuard.jsx`: onboarding/profile gate.
- `src/components/AdminRoute.jsx`: admin gate.
- `src/components/ErrorBoundary.jsx`: route error boundary wrapper.

## Candidate Pages

- `src/pages/LandingPage.jsx`: public marketing page.
- `src/pages/PricingPage.jsx`: public pricing page.
- `src/pages/CheckoutPage.jsx`: redirect-based checkout flow.
- `src/pages/Dashboard.jsx`: signed-in home.
- `src/pages/InterviewsPage.jsx`: interview type selection.
- `src/pages/PreInterviewForm.jsx`: interview setup.
- `src/pages/InterviewSessionRoom.jsx`: realtime interview runtime.
- `src/pages/ReportPage.jsx`: report and replay surface.
- `src/pages/AnalyticsPage.jsx`: analytics surface.
- `src/pages/CommunicationPracticePage.jsx`: communication practice flow.

## Auth Pages

- `src/pages/LoginPage.jsx`
- `src/pages/RegisterPage.jsx`
- `src/pages/ForgotPasswordPage.jsx`
- `src/pages/SetPasswordPage.jsx`
- `src/components/AuthShell.jsx`

## Admin Pages

- `src/pages/admin/AdminLayout.jsx`
- `src/pages/admin/AdminOverviewPage.jsx`
- `src/pages/admin/AdminLiveOpsPage.jsx`
- `src/pages/admin/AdminSecurityPage.jsx`
- `src/pages/admin/AdminCandidatesPage.jsx`
- `src/pages/admin/AdminCandidateDetailPage.jsx`
- `src/pages/admin/AdminInterviewsPage.jsx`
- `src/pages/admin/AdminQuestionBankPage.jsx`
- `src/pages/admin/AdminTrialsPage.jsx`
- `src/pages/admin/AdminExportsPage.jsx`
- `src/pages/admin/AdminConfigPage.jsx`

## Shared UI Patterns To Extract Later

- Page header with title, description, primary action.
- Backend unavailable error state.
- Empty state with one recovery action.
- Status badge/chip.
- Section panel.

Do not extract these until at least two migrated pages need the same pattern.

