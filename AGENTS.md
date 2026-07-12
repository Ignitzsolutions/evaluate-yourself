# AGENTS.md

This repository has two major runtimes:

1. **Frontend**: React app (root `src/`) served with `react-scripts`.
2. **Backend**: FastAPI service (under `backend/`) that provides interview APIs, realtime flow integration, and evaluation pipeline services.

## Execution map

- `npm start` -> frontend dev server
- `./start-backend.sh` -> backend startup helper
- `./start-all.sh` -> starts frontend and backend together
- `npm run build` -> production frontend build
- `npm test` -> frontend component/unit tests
- `npm run test:backend` -> backend test suite
- `npm run test:e2e` -> Playwright smoke/e2e

## Important directories

- `backend/api`, `backend/routes` - HTTP surfaces
- `backend/services` - business orchestration
- `backend/db`, `backend/migrations` - persistence and schema evolution
- `tests/` - e2e and integration checks
- `docs/` - architecture, troubleshooting, and archived reports
- `docs/guides/` - setup and operator-facing runbooks

## Realtime constraints

- The project uses backend-managed realtime provider flows and browser-native media paths.
- Avoid introducing unnecessary third-party websocket/audio wrappers where native/browser or existing backend abstractions are already used.
- Keep secrets server-side only (`backend/.env`), never exposed to frontend bundles.

## Working conventions

- Prefer minimal, targeted edits.
- Update docs when behavior or setup changes.
- Keep root clean: operational docs belong in `docs/guides/`; historical material belongs in `docs/archive/`.
- Business logic should not live inside visual components.
- Validate API and AI outputs before rendering or persisting them.
- Never perform authorization only in browser code.

## UI rules

- Reuse existing components before creating new ones.
- Use existing design tokens and component patterns; avoid arbitrary colors, spacing values, and one-off variants.
- Use one clear primary action per page.
- Implement loading, empty, error, and success states where the flow can reach them.
- Preserve user input during failures.
- Maintain keyboard accessibility and visible focus.
- Mobile behavior is required.
- Avoid unnecessary gradients, glass effects, decorative cards, and animation.
- Do not copy generic AI SaaS landing-page patterns.
- Do not use emojis as interface icons; use the existing icon system.
- Do not redesign the full app in one unreviewed operation.
- Migrate one route at a time: specification, implementation, review, correction, commit.
- Keep the existing MUI theme in `src/theme/theme.js` as the source of UI tokens unless a design-system change is approved.

## Completion requirements

Before marking a product-code task complete:

1. Run the smallest relevant type/import check.
2. Run the smallest relevant lint or formatting check.
3. Run relevant tests.
4. Verify keyboard interaction for changed UI.
5. Verify mobile layout for changed UI.
6. Report unresolved assumptions.

## Instruction placement

- `AGENTS.md` is for permanent project facts and non-negotiable constraints.
- `SKILL.md` files are for task-specific workflows such as frontend implementation, UI review, security audit, database migration, release preparation, performance audit, and accessibility audit.
- `.cursor/rules/*.mdc` is for narrow file- or directory-scoped rules, such as frontend rules for component folders, database rules for DB folders, testing rules for test folders, and API rules for API folders.
- `docs/*.md` is for detailed product and architecture references.
- Do not place the entire software-engineering handbook in one always-on file.

## Skill baseline guidance

For a solo-founder workflow, start with a small skill set instead of adding hundreds of skills. A reasonable baseline is:

```sh
npx skills add addyosmani/agent-skills --skill frontend-ui-engineering
npx skills add vercel-labs/agent-skills --skill web-design-guidelines
npx skills add vercel-labs/agent-skills --skill vercel-react-best-practices
npx skills add shadcn-ui/ui --skill shadcn
npx skills add addyosmani/web-quality-skills --all
```

Adding too many skills makes routing, instruction conflicts, and context usage worse.
