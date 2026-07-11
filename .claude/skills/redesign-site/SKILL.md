---
name: redesign-site
description: Controlled workflow for revising this SaaS UI without damaging product behavior.
---

# Redesign Site

Use this workflow for broad UI revision requests:

1. Audit first: update `docs/current-ui-audit.md` and `docs/component-inventory.md`.
2. Define UX: update `docs/user-flows.md`, `docs/redesign-brief.md`, and `docs/page-specifications.md`.
3. Confirm design system: use `docs/design-system.md` and `src/theme/theme.js`.
4. Implement one representative route.
5. Review against `docs/ui-acceptance-criteria.md`.
6. Migrate remaining routes one at a time.

Do not redesign the full app in one unreviewed operation.

