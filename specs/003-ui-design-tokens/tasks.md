# Tasks: UI Design Tokens & Modern Restyle

**Input**: Design documents from `specs/003-ui-design-tokens/`
**Prerequisites**: [plan.md](plan.md) · [spec.md](spec.md) · [research.md](research.md) · [data-model.md](data-model.md) · [contracts/component-styles.md](contracts/component-styles.md) · [quickstart.md](quickstart.md)

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel with other [P] tasks in the same phase (different files, no shared dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Exact file paths included in every task description

---

## Phase 1: Setup (ESLint Infrastructure)

**Purpose**: Add and configure ESLint in the client package so the no-inline-styles lint rule can be enforced in CI (FR-001).

- [X] T001 Install ESLint dev dependencies in `client/package.json`: `eslint`, `@eslint/js`, `globals`, `eslint-plugin-react`
- [X] T002 [P] Create `client/eslint.config.js` as flat-config ESM module with `react/forbid-component-props` rule targeting `style` (see research.md § Topic 2 for exact config)
- [X] T003 [P] Add `"lint": "eslint src"` script to `client/package.json` scripts section

**Checkpoint**: Run `cd client && npx eslint src` — expect many errors (existing inline styles flagged). This is the expected Red state before Phase 3.

---

## Phase 2: Foundational (Design Token System)

**Purpose**: Create the single global token source and shared base styles that ALL component CSS files depend on. MUST be complete before any user story phase begins.

**⚠️ CRITICAL**: Phase 3, 4, and 5 cannot begin until T004–T007 are complete.

- [X] T004 Create directory structure `client/src/styles/` and `client/src/styles/components/` (no files yet)
- [X] T005 [P] Create `client/src/styles/tokens.css` with the full `:root` block: 13 color primitives (`--indigo-600`, `--gray-50`, etc.) and all semantic tokens (`--color-primary`, `--color-status-connected`, `--color-message-error`, spacing, typography, shape) per data-model.md Token Taxonomy
- [X] T006 [P] Create `client/src/styles/global.css` with: box-sizing reset (`*`), body base styles, `h1` heading scale, shared `.btn` class (with `:hover`, `:focus-visible`, `:disabled` states — **do NOT add `:active` yet; that is added in T020**), shared `.input` class (with `:focus` state using `var(--color-primary-ring)` for box-shadow and `.input--room-id` modifier) — all properties using `var(--token-name)` per contracts/component-styles.md Global Styles Contract
- [X] T007 Update `client/src/main.jsx` to import `./styles/tokens.css` and `./styles/global.css` before the `App` import, making all CSS Custom Properties available globally

**Checkpoint**: App should load with light gray background, changed font, and restyled body defaults visible (even before component-level CSS is added).

---

## Phase 3: User Story 1 — Consistent Visual Experience (Priority: P1) 🎯 MVP

**Goal**: Every component renders with a clean, light, modern visual aesthetic. Inline `style` props are replaced with CSS classes backed by the token system.

**Independent Test**: Load Home Page and Room Page in a browser. Confirm: light neutral background, indigo buttons, sans-serif typography, consistent spacing, connection badge with colored pill, confirm dialog with yellow warning surface — all without any raw HTML defaults visible.

### CSS Files for User Story 1

- [X] T008 [P] [US1] Create `client/src/styles/components/homepage.css` — define `.home-page` (centered flex column, `--spacing-lg` padding), `.home-page__message--warning` (`color: var(--color-message-warning)`), `.home-page__message--error` (`color: var(--color-message-error)`), `.home-page__divider` (`border-color: var(--color-border)`, `width: 100%`), `.home-page__join-row` (`display: flex`, `gap: var(--spacing-sm)`) per contracts/component-styles.md HomePage contract
- [X] T009 [P] [US1] Create `client/src/styles/components/roompage.css` — define `.room-page` (`display: flex; flex-direction: column; height: 100vh`), `.room-page__header` (`background: var(--color-surface-card)`, padding, `border-bottom: 1px solid var(--color-border)`, `box-shadow: var(--shadow-sm)`), `.room-page__room-id` (`font-family: var(--font-family-mono)`, `font-weight: var(--font-weight-bold)`, `color: var(--color-text-secondary)`), `.room-page__canvas-area` (`flex: 1; position: relative; overflow: hidden`) per contracts/component-styles.md RoomPage contract
- [X] T010 [P] [US1] Create `client/src/styles/components/toolbar.css` — define `.toolbar` (`display: flex; align-items: center; gap: var(--spacing-sm)`, `background: var(--color-surface-card)`, `padding: var(--spacing-xs) var(--spacing-sm)`, `border-radius: var(--radius-md)`, `box-shadow: var(--shadow-sm)`), `.toolbar__btn` (base inactive button style using border, radius, padding tokens), `.toolbar__btn--active` (`background: var(--color-primary); color: var(--color-text-on-primary)`) per contracts/component-styles.md Toolbar contract
- [X] T011 [P] [US1] Create `client/src/styles/components/connectionstatus.css` — define `.connection-status` (fixed position pill: `position: fixed; bottom: 1rem; right: 1rem; padding: var(--spacing-xs) var(--spacing-sm); border-radius: var(--radius-full); font-size: var(--font-size-sm); font-weight: var(--font-weight-bold); color: var(--color-text-on-primary); z-index: 9999`), `.connection-status--connected` (`background-color: var(--color-status-connected)`), `.connection-status--reconnecting` (`background-color: var(--color-status-reconnecting)`), `.connection-status--disconnected` (`background-color: var(--color-status-disconnected)`) per contracts/component-styles.md ConnectionStatus contract
- [X] T012 [P] [US1] Create `client/src/styles/components/confirmdialog.css` — define `.confirm-dialog` (`display: inline-flex; align-items: center; gap: var(--spacing-sm); padding: var(--spacing-sm); background: var(--color-warning-surface); border: 1px solid var(--color-warning-border); border-radius: var(--radius-sm)`) per contracts/component-styles.md ConfirmDialog contract

### Test Updates — TDD Pre-step (update before JSX refactors)

> **Constitution Principle I compliance**: Update the test assertions now so they go **Red** (failing against current inline-style code). The JSX refactors below will then make them **Green**. This maintains the Red → Green → Refactor TDD cycle and prevents a broken CI window.

- [X] T018 [P] [US2] Update `client/tests/unit/ConnectionStatus.test.jsx` — replace every `toHaveStyle('background-color: ...')` assertion with the corresponding `toHaveClass('connection-status--connected')`, `toHaveClass('connection-status--reconnecting')`, or `toHaveClass('connection-status--disconnected')` assertion; confirm the base `.connection-status` class is also asserted on the element
- [X] T019 [P] [US2] Update `client/tests/unit/Toolbar.test.jsx` — replace every `toHaveStyle('font-weight: bold')` assertion for the active tool button with `toHaveClass('toolbar__btn--active')`; replace normal-weight assertion with a check that `toolbar__btn--active` is NOT present; confirm the base `.toolbar__btn` class is present on all tool buttons

**Checkpoint**: Run `npm test` — T018/T019 changes cause those specific tests to **fail** (Red). This is expected and correct. The JSX refactors below will resolve them.

### JSX Refactor for User Story 1

- [X] T013 [P] [US1] Refactor `client/src/components/HomePage.jsx` — import `../../styles/components/homepage.css`; replace root `style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '2rem', gap: '1rem' }}` with `className="home-page"`; replace `style={{ color: 'orange' }}` with `className="home-page__message--warning"`; replace `style={{ width: '100%' }}` with `className="home-page__divider"`; replace `style={{ display: 'flex', gap: '0.5rem' }}` with `className="home-page__join-row"`; replace `style={{ color: 'red' }}` with `className="home-page__message--error"`; replace `style={{ textTransform: 'uppercase' }}` on input with `className="input input--room-id"`; add `className="btn"` to both buttons
- [X] T014 [P] [US1] Refactor `client/src/components/RoomPage.jsx` — import `../../styles/components/roompage.css`; replace root `style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}` with `className="room-page"`; replace header `style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 1rem', borderBottom: '1px solid #ddd' }}` with `className="room-page__header"`; replace `style={{ fontFamily: 'monospace', fontWeight: 'bold' }}` with `className="room-page__room-id"`; replace canvas wrapper `style={{ flex: 1, position: 'relative', overflow: 'hidden' }}` with `className="room-page__canvas-area"`; add `className="btn"` to Leave button
- [X] T015 [P] [US1] Refactor `client/src/components/Toolbar.jsx` — import `../../styles/components/toolbar.css`; replace root `style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem' }}` with `className="toolbar"`; replace per-button `style={{ fontWeight: activeTool === X ? 'bold' : 'normal' }}` with dynamic `className={\`toolbar__btn\${activeTool === TOOL_NAMES.PEN ? ' toolbar__btn--active' : ''}\`}` (and same pattern for ERASER button) — remove the `style` props entirely
- [X] T016 [P] [US1] Refactor `client/src/components/ConnectionStatus.jsx` — import `../../styles/components/connectionstatus.css`; replace the `STYLES` object and spread-into-`style` pattern with a `STATUS_CLASS` map `{ [CONNECTION_STATUS.CONNECTED]: 'connection-status--connected', [CONNECTION_STATUS.RECONNECTING]: 'connection-status--reconnecting', [CONNECTION_STATUS.DISCONNECTED]: 'connection-status--disconnected' }`; apply `className={\`connection-status \${STATUS_CLASS[status]}\`}` to the `<span>`; remove all inline `style` usage
- [X] T017 [P] [US1] Refactor `client/src/components/ConfirmDialog.jsx` — import `../../styles/components/confirmdialog.css`; replace the inline `style={{ display: 'inline-flex', ..., background: '#fff3cd', border: '1px solid #ffc107', borderRadius: '4px' }}` with `className="confirm-dialog"`; add `className="btn"` to Confirm and Cancel buttons; remove all inline `style` usage

**Checkpoint**: Visual snapshot of both pages should look clean, light, and modern. Run `npx eslint src` — all remaining violations should come only from `Canvas.jsx` cursor/touchAction (excluded per spec) or none at all.

---

## Phase 4: User Story 2 — Verify Style Source of Truth (Priority: P2)

**Goal**: Confirm the test suite is green after the JSX refactors complete. T018 and T019 were applied in Phase 3 (TDD pre-step) and went Red; the Phase 3 JSX refactors made them Green. This phase is the verification checkpoint.

**Independent Test**: `cd client && npm test` exits with zero failures. `npx eslint src` exits with zero violations.

**Checkpoint**: `cd client && npm test` — all tests pass with zero failures. No tests skipped or commented out. (T018/T019 assertions now match the class-based component output.)

---

## Phase 5: User Story 3 — Accessible and Clear Interactive States (Priority: P3)

**Goal**: All interactive elements (buttons, inputs, tool buttons) have visible, intentional hover, focus, active, and disabled states. None fall back to browser defaults.

**Independent Test**: Open both pages. Tab through all interactive elements (Create Room button, Join Room button, Room ID input, tool buttons, Leave button, Confirm/Cancel in dialog). For each: trigger hover, focus, click (active), and disabled state. Confirm all states are visually distinct and do not use browser-default outlines or styles.

- [X] T020 [P] [US3] Extend `client/src/styles/global.css` with the one remaining interactive state NOT created in T006: add `.btn:active { transform: translateY(1px); }`. Also verify no raw hex values remain in the file — the input focus shadow rule written in T006 MUST use `box-shadow: 0 0 0 3px var(--color-primary-ring)`, not a raw `rgba(...)` value. Correct it if needed. All rules MUST use only `var(--token-name)` values.
- [X] T021 [P] [US3] Extend `client/src/styles/components/toolbar.css` with: `.toolbar__btn:hover { background-color: var(--color-primary); color: var(--color-text-on-primary); opacity: 0.85; }`, `.toolbar__btn:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }` — these cover the tool selector interactive contrast described in US3 acceptance scenario 2

**Checkpoint**: Tab through all interactive elements on both pages and confirm every state is visually intentional. No raw blue browser-default focus outlines. No invisible disabled states.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Machine-verify all success criteria before marking the feature complete.

- [X] T022 Run `cd client && npx eslint src` and confirm **zero** violations — if any remain (from `Canvas.jsx` `touchAction`/cursor inline styles, which are functional not aesthetic), add a targeted `// eslint-disable-next-line react/forbid-component-props` comment on those specific lines only with an explanation comment. Also verify SC-002 and SC-003: `grep -r '#[0-9a-fA-F]\{3,6\}' client/src/styles/components/` should return **zero** matches (no raw hex in component CSS); manually change `--color-primary` in `tokens.css` to a test value, reload the app, confirm buttons and active states update, then revert.
- [X] T023 Run `cd client && npm test` and confirm **all tests pass** with zero failures and zero skipped tests — this validates SC-007 and FR-011 compliance
- [X] T024 [P] Verify the minimum-viable responsive guard (Clarification Q2): open the app at 768px viewport width and confirm the `.connection-status` badge does not overlap toolbar controls or any interactive element. Add `min-width: 320px` to the `body` rule in `client/src/styles/global.css` to prevent sub-320px layout collapse.

**Final Checkpoint**: SC-001 (lint: 0 violations), SC-007 (tests: 0 failures), SC-005 (visual: open browser and confirm light/modern/simple appearance), SC-006 (interactive: tab through both pages).

---

## Dependency Graph

```
T001 ─────────────────┐
                      ├─► T002 (parallel with T003)
                      └─► T003

T004 ─────────────────┐
                      ├─► T005 (parallel with T006)
                      └─► T006
T005, T006 ──────────► T007

T007 ─────────────────┐
                      ├─► T008..T012 (CSS creation, all parallel)
                      └─► T018, T019 (test updates, parallel — go Red)

T008..T012 + T018 + T019
                      ├─► T013 ─► T016 (tests go Green)
                      ├─► T014
                      ├─► T015 ─► T019 already Green
                      ├─► T016
                      └─► T017

T013..T017 ──────────► T020, T021 (US3 interactive states)
T020, T021 ──────────► T022, T023, T024
```

**User Story Completion Order**: US1 CSS + TDD test updates (Red) → US1 JSX refactors (Green) → US3 interactive states → Lint + Test + Responsive verification

**Parallel Opportunities**:
- T002 ∥ T003 (both within Phase 1, different files)
- T005 ∥ T006 (both within Phase 2 after T004, different files)
- T008 ∥ T009 ∥ T010 ∥ T011 ∥ T012 ∥ T018 ∥ T019 (CSS creation + test updates all target different files; test updates intentionally go Red here)
- T013 ∥ T014 ∥ T015 ∥ T016 ∥ T017 (JSX refactor tasks, different component files)
- T020 ∥ T021 (different CSS files)
- T022 ∥ T023 ∥ T024 (different verification targets)

## Implementation Strategy

**MVP (after Phase 3)**: User Story 1 alone — the app is fully restyled and visually modern. CSS token system is in place. Tests may temporarily assert class names after US2 implementation. Lint rule added but not yet all-green.

**Increment 2 (after Phase 4)**: US2 — test suite is green with migrated assertions. Lint rule passes. Feature is verifiably complete on SC-001 and SC-007.

**Full delivery (after Phase 5 + 6)**: US3 — all interactive states are explicit and accessible. All success criteria SC-001 through SC-007 verified.
