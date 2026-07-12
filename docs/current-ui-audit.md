# Current UI Audit

This is the first-pass audit baseline for the v1 UI revision. It is based on source inspection, not a full browser screenshot pass.

## What Works

- The route tree is centralized in `src/App.js`, which makes public, auth, app, admin, and interview routes easy to reason about.
- The MUI theme in `src/theme/theme.js` already defines the main palette, typography, spacing, border radius, and component defaults.
- Critical interview routes are protected by `PrivateRoute` and `OnboardingGuard`, with fullscreen interview routes separated from the app shell.
- Pricing and checkout are public routes, which allows purchase intent to work without backend profile checks.

## Findings

### High

- Page visual language is inconsistent across candidate surfaces.
  - Page: dashboard, interviews, interview setup, report
  - Files: `src/pages/Dashboard.jsx`, `src/pages/InterviewsPage.jsx`, `src/pages/PreInterviewForm.jsx`, `src/pages/ReportPage.jsx`
  - Problem: pages mix dense cards, custom backgrounds, and different header patterns.
  - Impact: the app feels assembled instead of product-led.
  - Correction: standardize `PageHeader`, primary action placement, and white-surface panels before broad redesign.

- Interview setup recovery can still feel fragile when backend-dependent data is unavailable.
  - Page: interview setup
  - File: `src/pages/PreInterviewForm.jsx`
  - Problem: skill loading and failure states need obvious retry and disabled-action behavior.
  - Impact: users can attempt to proceed while setup prerequisites are not ready.
  - Correction: keep the submit action disabled while required catalog data is loading or unavailable, and show inline retry.

### Medium

- Some pages have more than one visually dominant action.
  - Page: app workflow pages
  - Files: `src/pages/InterviewsPage.jsx`, `src/pages/Dashboard.jsx`, `src/pages/ReportPage.jsx`
  - Problem: repeated cards and nested CTAs compete for attention.
  - Impact: users spend effort deciding where to click instead of progressing.
  - Correction: use one primary action per page and make secondary actions quiet.

- Custom layout classes and MUI `sx` styles overlap.
  - Page: app pages
  - Files: `src/ui.css`, `src/index.css`, `src/pages/*.jsx`
  - Problem: styling is split between global classes and local `sx` without a route-by-route rule.
  - Impact: spacing and surfaces drift over time.
  - Correction: keep global utilities minimal and prefer theme-backed `sx` for page-level composition.

### Low

- Visual polish relies heavily on cards and chips.
  - Page: candidate workflow
  - Files: `src/pages/InterviewsPage.jsx`, `src/pages/PreInterviewForm.jsx`
  - Problem: chips are useful, but too many make hierarchy noisy.
  - Impact: pages feel busier than needed.
  - Correction: reserve chips for status, selected state, and compact metadata.

## Retain

- MUI theme as the design-token source.
- Existing route boundaries in `src/App.js`.
- White/light product direction.
- Interview-first candidate flow.

## Remove Or Reduce

- Arbitrary page backgrounds.
- Nested primary CTAs inside selectable cards.
- Trial-code copy on free-access surfaces.
- One-off visual treatments not backed by the theme.

