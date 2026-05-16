# Implementation Plan: UI Design Tokens & Modern Restyle

**Branch**: `feature/003-ui-design-tokens` | **Date**: 2026-05-15 | **Spec**: [spec.md](spec.md)  
**Input**: Feature specification from `specs/003-ui-design-tokens/spec.md`

## Summary

Extract all scattered inline `style` props from five React components (`HomePage`, `RoomPage`, `Toolbar`, `ConnectionStatus`, `ConfirmDialog`) into external CSS class files. Introduce a single `tokens.css` global file defining CSS Custom Properties for color (brand, semantic status, semantic message, neutral), spacing, typography, and shape. Restyle the UI to a simple, light, modern aesthetic using an indigo primary accent. Enforce the no-inline-styles constraint via an ESLint `react/forbid-component-props` rule added to CI. Update any existing tests that assert against inline style values to assert class names instead.

## Technical Context

**Language/Version**: JavaScript (ES2022 modules), React 18.3, JSX  
**Primary Dependencies**: React 18, Vite 5, Vitest 1, @testing-library/react 16, @testing-library/jest-dom 6  
**Build**: Vite 5 with `@vitejs/plugin-react`; CSS files imported directly — no SCSS, no CSS Modules, no CSS-in-JS  
**Storage**: N/A (client-side only; no new persistence)  
**Testing**: Vitest + @testing-library/react + jsdom; test assertions migrated from `toHaveStyle` to `toHaveClass`  
**Lint/CI**: No ESLint config exists yet; `eslint` + `eslint-plugin-react` added; flat config (`eslint.config.js`) required (project uses `"type": "module"`)  
**Target Platform**: Modern desktop browser (Chrome/Firefox/Edge); primary viewport ≥ 1024px; minimum viable guard below that  
**Project Type**: React SPA (frontend only; server unchanged)  
**Performance Goals**: N/A — styling refactor; no runtime computation added  
**Constraints**: No SCSS, no CSS Modules, no CSS-in-JS; CSS Custom Properties only; canvas element excluded from restyle  
**Scale/Scope**: 5 components, 1 token file, 1 ESLint config; ~10 unit tests updated

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| **I. Test-First (TDD)** | ✅ PASS | Existing tests updated (not broken); ESLint rule makes SC-001 machine-verifiable. FR-011 requires test suite to stay green. No new behavior added that requires net-new tests. |
| **II. Modularity** | ✅ PASS | Each component gets its own CSS file with a single visual responsibility. Token file is shared but read-only; no coupling introduced. |
| **III. Event-Driven** | ✅ N/A | No events added or changed. Server untouched. |
| **IV. Idempotency** | ✅ N/A | No operations or state mutations. |
| **V. Convergence** | ✅ N/A | No collaborative state affected. |
| **VI. Loose Coupling** | ✅ PASS | CSS Custom Properties are the loosest possible style coupling: `tokens.css` defines; components consume via `var()`; no import chain created between components. |
| **VII. Observability** | ✅ N/A | Server logging unaffected. Client errors unchanged. |
| **VIII. Resilience** | ✅ N/A | Connection logic and reconnect behavior unchanged. |

**Gate result**: All applicable principles PASS. No violations to justify.

## Project Structure

### Documentation (this feature)

```text
specs/003-ui-design-tokens/
├── plan.md              ← this file
├── research.md          ← Phase 0 output
├── data-model.md        ← Phase 1 output (token taxonomy)
├── quickstart.md        ← Phase 1 output
├── contracts/
│   └── component-styles.md   ← Phase 1 output (component/class contracts)
└── tasks.md             ← Phase 2 output (/speckit.tasks — not created by /speckit.plan)
```

### Source Code (repository root)

```text
client/
├── eslint.config.js          ← NEW: ESLint flat config (react/forbid-component-props)
├── package.json              ← UPDATED: add eslint, eslint-plugin-react devDependencies
└── src/
    ├── main.jsx              ← UPDATED: import './styles/tokens.css'
    └── styles/
        ├── tokens.css        ← NEW: all CSS Custom Properties (:root)
        ├── global.css        ← NEW: base reset, body, typography defaults
        └── components/
            ├── homepage.css
            ├── roompage.css
            ├── toolbar.css
            ├── connectionstatus.css
            └── confirmdialog.css

client/src/components/        ← UPDATED: inline style props removed, className added
├── HomePage.jsx
├── RoomPage.jsx
├── Toolbar.jsx
├── ConnectionStatus.jsx
└── ConfirmDialog.jsx

client/tests/unit/            ← UPDATED: toHaveStyle → toHaveClass assertions
├── ConnectionStatus.test.jsx
└── Toolbar.test.jsx
```

**Structure Decision**: Frontend-only change using the existing `client/` workspace. No server, shared, or e2e changes required. A new `client/src/styles/` directory is introduced to co-locate the token system and component-scoped CSS alongside existing source code. No new packages or build pipeline complexity is added.
