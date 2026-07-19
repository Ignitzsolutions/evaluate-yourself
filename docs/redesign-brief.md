# Redesign Brief

## Objective

Move the product UI from a collection of screens to a coherent coaching SaaS experience without changing core business behavior.

## Direction A: Recommended

- Calm, credible interview workspace.
- White and near-white surfaces.
- Deep blue as the only dominant action color.
- Dark slate text, restrained grey borders, minimal shadows.
- MUI theme tokens are the source of truth.
- One primary action per screen.
- Candidate flow gets migrated first.

## Direction B: Conservative

- Keep current theme and layout shell.
- Only reduce visual noise, normalize headers, and repair broken states.
- No new global components until duplication is proven.

## Product Constraints

- The interview runtime must remain reliable before visual novelty.
- Sonia status, listening, speaking, recovery, and save states must be obvious.
- Trial/free access copy must match the active access mode.
- Payment surfaces remain redirect-only for now.

## Out Of Scope For This Slice

- Full landing page redesign.
- Admin redesign.
- Report replay redesign.
- New animation system.
- New component library.

