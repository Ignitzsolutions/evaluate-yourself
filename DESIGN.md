# Design

## Visual Theme

Restrained product UI built on Material UI: light neutral surfaces, strong blue primary actions, compact cards, and clear data-first hierarchy for practice and admin flows.

## Color

- Primary: `#0056B3`
- Secondary: `#E63946`
- Success: `#2E7D32`
- Error: `#D32F2F`
- Warning: `#ED6C02`
- Info: `#0288D1`
- Background default: `#F8F9FA`
- Background paper: `#FFFFFF`
- Text primary: `#212121`
- Text secondary: `#616161`

## Typography

- Family: `Lato, Roboto, "Helvetica Neue", Arial, sans-serif`
- Scale:
  - `h1` 2.5rem / 700
  - `h2` 2rem / 700
  - `h3` 1.75rem / 600
  - `h4` 1.5rem / 600
  - Body defaults: 1rem / 0.875rem
- Buttons use sentence case (`textTransform: none`).

## Spacing, Shape, and Elevation

- Base spacing function: `0.5rem * factor`
- Radius system: 8px default, 12px cards
- Elevation: soft shadows (2–24px blur layers), no heavy glass effects

## Components

- MUI buttons, cards, chips, text fields, alerts as primary vocabulary
- Practice UX pattern:
  - One primary next action at a time
  - Inline error recovery with retry
  - Trend context (current line + baseline line)
- Admin and candidate surfaces share the same token set and interaction language

## Motion

- Minimal and state-driven
- No decorative page-load choreography
- Chart/feedback interactions prioritize responsiveness over flourish

## Accessibility

- Target WCAG 2.1 AA contrast and focus clarity
- Plain-language coaching labels over raw technical flags
- Keyboard-accessible practice flow, including shortcut-assisted repetition
