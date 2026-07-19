# Design System

## Source Of Truth

Use the existing MUI theme in `src/theme/theme.js`.

Do not add route-specific colors, spacing scales, or shadow systems without updating the theme.

## Visual Direction

- Background: `background.default`
- Main surfaces: `background.paper`
- Primary action: `primary.main`
- Text: `text.primary` and `text.secondary`
- Borders: `divider`
- Error/warning/success: MUI semantic palette

## Typography

Use the theme typography scale. Page titles should use `h3` or `h4`; avoid oversized hero headings inside workflow pages.

## Layout

- Use `Container maxWidth="lg"` for app workflow pages.
- Keep one main page panel when a workflow needs focus.
- Use `Stack` and `Grid` for layout; avoid custom layout systems.
- Avoid horizontal overflow at 320px and above.

## Buttons

- One contained primary action per page.
- Use outlined buttons for secondary actions.
- Buttons must name the action clearly.

## Forms

- Keep labels visible.
- Preserve field values after failures.
- Use inline `Alert` or helper text for recoverable errors.
- Disable submit only when the reason is visible.

## Icons

Use MUI/Google Material icons. Do not use emoji icons.

## Motion

Keep motion minimal. No decorative page-load animation until the core workflow is stable.

