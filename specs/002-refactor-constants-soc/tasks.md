---

description: "Task list for Codebase Refactor — Constants & Separation of Concerns"

---

# Tasks: Codebase Refactor — Constants & Separation of Concerns

**Input**: Design documents from `specs/002-refactor-constants-soc/`
**Branch**: `002-refactor-constants-soc`
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/hook-interfaces.md ✓

**Scope**: Pure structural refactor — zero observable behaviour change. All existing tests must pass without modification throughout.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (operates on different files, no incomplete-task dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Exact file paths are included in every task description

---

## Phase 1: Setup (Baseline Verification)

**Purpose**: Confirm the test suite is green before any changes are made. This is the baseline proof for US1.

- [X] T001 Run full baseline test suite and confirm all tests pass: `cd server && npm test`, `cd client && npm test -- --run`, and `cd e2e && npx playwright test` (requires server on :3001)

---

## Phase 2: Foundational (Blocking Prerequisite)

**Purpose**: Extend `shared/constants.js` with the three new constant groups. **Every literal replacement and hook extraction depends on this task.**

**⚠️ CRITICAL**: No US2 or US3 work can begin until this phase is complete.

- [X] T002 Add `TOOL_NAMES`, `CONNECTION_STATUS`, and `ERROR_CODES` export groups to `shared/constants.js` (append after existing exports; do not modify existing exports)

**Checkpoint**: Run `cd client && npm test -- --run` — all existing tests must still pass (additions only, no breakage).

---

## Phase 3: User Story 1 — Application Behaves Identically After Refactor (Priority: P1) 🎯 MVP

**Goal**: The full automated test suite continues to pass without any test modifications at every stage of the refactor. This story's acceptance gate is executed as checkpoints in every subsequent phase.

**Independent Test**: Run the full existing test suite (`server`, `client`, `e2e`) and confirm every test passes before *and* after the refactor.

- [X] T003 [US1] Run client + server tests after T002 to confirm zero regressions from constants additions in `client/tests/unit/` and `server/tests/`

**Checkpoint**: All tests green ✓ — safe to begin US2 literal replacements.

---

## Phase 4: User Story 2 — No Magic Literals in Code That Duplicate a Shared Constant (Priority: P2)

**Goal**: Replace bare string and numeric literals in the four non-component files (`socket.js`, `ConnectionStatus.jsx`, `eventHandlers.js`, `useRoom.js`). Note: literals inside `HomePage.jsx`, `RoomPage.jsx`, `Canvas.jsx`, and `Toolbar.jsx` are resolved during Phase 5 component refactors (T012, T015, T018, T019). SC-002/SC-003 are only fully satisfied after T022/T023 in the Final Phase.

**Independent Test**: A code-level search confirms zero occurrences of those raw literals in `client/src/`, `server/src/`, and `shared/` (excluding `constants.js` itself and all `*.test.*` / `e2e/` files).

> All four T004–T007 tasks operate on different files with no inter-dependencies and **can run in parallel**.

- [X] T004 [P] [US2] Replace `'Connected'`, `'Reconnecting'`, `'Disconnected'` bare string literals in `client/src/services/socket.js` with `CONNECTION_STATUS.CONNECTED`, `CONNECTION_STATUS.RECONNECTING`, `CONNECTION_STATUS.DISCONNECTED`; add `CONNECTION_STATUS` to the `shared/constants.js` import
- [X] T005 [P] [US2] Replace `'Connected'`, `'Reconnecting'`, `'Disconnected'` bare string literals (STYLES object keys and `useState` default) in `client/src/components/ConnectionStatus.jsx` with `CONNECTION_STATUS.*`; add `CONNECTION_STATUS` to the `shared/constants.js` import
- [X] T006 [P] [US2] Replace `'ROOM_NOT_FOUND'` and `'SERVER_ERROR'` bare string literals in `server/src/handlers/eventHandlers.js` with `ERROR_CODES.ROOM_NOT_FOUND` and `ERROR_CODES.SERVER_ERROR`; add `ERROR_CODES` to the `shared/constants.js` import
- [X] T007 [P] [US2] Replace `'ROOM_NOT_FOUND'` bare string comparison in `client/src/hooks/useRoom.js` with `ERROR_CODES.ROOM_NOT_FOUND`; add `ERROR_CODES` to the `shared/constants.js` import
- [X] T008 [US2] Run client and server test suites (`cd client && npm test -- --run` and `cd server && npm test`) to confirm zero regressions after T004–T007

**Checkpoint**: All literal replacements complete; tests still green ✓ — safe to begin US3 hook extractions.

---

## Phase 5: User Story 3 — Business Logic Separated from Presentation in All Components (Priority: P3)

**Goal**: Each refactored component (`HomePage`, `RoomPage`, `Canvas`, `Toolbar`) contains only JSX and event-binding coordination; all state management, validation, and socket interactions live in dedicated hooks. No component in the list may import directly from `../services/socket.js`.

**Independent Test**: Each extracted hook (`useHomePage`, `useCanvasRenderer`) has a dedicated unit test file that exercises its logic without mounting a React component; each refactored component passes its existing tests unchanged.

### Tests for User Story 3 — Write First (TDD-red) ⚠️

> **Follow Constitution I + SC-005**: Write these test files BEFORE implementing the hooks. Run them and confirm they FAIL (red phase) before proceeding to implementation.

- [X] T009 [P] [US3] Write `client/tests/unit/useHomePage.test.js` (TDD-red): cover `handleJoin` with too-short input → sets `error`; invalid characters → sets `error`; valid input → calls `joinRoom`, invokes `onRoomJoined`; `handleCreate` success → calls `createRoom`, invokes `onRoomJoined`; `handleCreate` failure → sets `error`; `handleInputChange` clears existing `error`
- [X] T010 [P] [US3] Write `client/tests/unit/useCanvasRenderer.test.js` (TDD-red): cover `renderDraw` called for a `OP_TYPE.DRAW` op; `renderErase` called for a `OP_TYPE.ERASE` op; canvas fully cleared before each render pass; `dirtyRef` behaviour (re-render on `operations` change, no render when not dirty). **Test harness**: stub `HTMLCanvasElement.prototype.getContext` to return a mock 2D context (see existing `useCanvas.test.js` for the pattern), mock `requestAnimationFrame` via `vi.useFakeTimers()` / `vi.spyOn(globalThis, 'requestAnimationFrame')`, and stub `ResizeObserver` as a class mock (`vi.stubGlobal('ResizeObserver', ...)`).

Run tests after T009 and T010 — confirm both new test files **FAIL** (red). ✓

### Implementation for User Story 3

- [X] T011 [US3] Implement `client/src/hooks/useHomePage.js` per `contracts/hook-interfaces.md`: expose `{ input, error, loading, handleInputChange, handleCreate, handleJoin }`; derive `ROOM_ID_PATTERN` from `ROOM_ID_ALPHABET` + `ROOM_ID_LENGTH`; use `ERROR_CODES` when mapping socket rejection; guard against double-submit when `loading === true`
- [X] T012 [US3] Refactor `client/src/components/HomePage.jsx` to a thin presentational component: remove all inline state, validation regex, and direct `createRoom`/`joinRoom` calls; delegate entirely to `useHomePage({ onRoomJoined })`; retain only JSX and event-binding
- [X] T013 [US3] Run client tests (`cd client && npm test -- --run`) — confirm `useHomePage` tests go **GREEN** and all existing `HomePage` tests still pass
- [X] T014 [US3] Implement `client/src/hooks/useCanvasRenderer.js` per `contracts/hook-interfaces.md`: accept `(canvasRef, operations, getVisibleOperations)`; own the `requestAnimationFrame` render loop, `dirtyRef`, `renderDraw`, `renderErase`, and `ResizeObserver` resize logic; return `void`; clean up RAF loop and observer on unmount
- [X] T015 [US3] Refactor `client/src/components/Canvas.jsx` to delegate all rendering logic to `useCanvasRenderer(canvasRef, operations, getVisibleOperations)`; retain only the `<canvas>` JSX element and pointer-event handlers
- [X] T016 [US3] Run client tests — confirm `useCanvasRenderer` tests go **GREEN** and all existing `Canvas` + `useCanvas` tests still pass
- [X] T017 [US3] Extend `client/src/hooks/useRoom.js` to absorb the reconnect `useEffect` from `RoomPage`: handle socket `'reconnect'` event by calling `joinRoom(roomId, lastSequence)` and `addOperations(delta)` on success; accept `addOperations` as a new optional parameter; use `ERROR_CODES.ROOM_NOT_FOUND` when handling `onLeaveRoom` for reconnect failure
- [X] T018 [US3] Refactor `client/src/components/RoomPage.jsx`: remove `getSocket` and `joinRoom` imports from `services/socket.js`; remove the inline reconnect `useEffect`; pass `addOperations` to `useRoom`; replace `useState('pen')` with `useState(TOOL_NAMES.PEN)`; replace `data?.error === 'ROOM_NOT_FOUND'` with `ERROR_CODES.ROOM_NOT_FOUND`; define and pass `onClear` handler (generates `operationId` via `crypto.randomUUID()`, calls `emitClear`) down to `Toolbar`. **Note**: `addOperations` (the dedup-merge `useCallback`) intentionally remains in `RoomPage` — it is bridge/glue state, not business logic, and is an accepted trade-off per plan.md §4.2. Do not extract it into a separate hook.
- [X] T019 [US3] Refactor `client/src/components/Toolbar.jsx`: replace all `'pen'` and `'eraser'` string literals with `TOOL_NAMES.PEN` / `TOOL_NAMES.ERASER`; remove direct `emitClear` socket call from `handleConfirmClear`; receive and invoke the `onClear` prop supplied by `RoomPage` instead
- [X] T020 [US3] Run full client test suite (`cd client && npm test -- --run`) after all component refactors to confirm zero regressions across all unit tests

**Checkpoint**: All extracted hooks tested and green; all refactored components pass existing tests without modification ✓

---

## Final Phase: Polish & Cross-Cutting Concerns

**Purpose**: Final quality gate for US1 — confirm the entire test suite (unit, integration, E2E) passes with zero modifications, and validate all success criteria.

- [X] T021 Run complete test suite end-to-end: `cd server && npm test`, `cd client && npm test -- --run`, `cd e2e && npx playwright test` (requires server on :3001) — every test must pass; zero failures
- [X] T022 [P] Verify SC-002 — search production source files (`client/src/`, `server/src/`, `shared/`) for bare string literals `'pen'`, `'eraser'`, `'Connected'`, `'Reconnecting'`, `'Disconnected'`, `'ROOM_NOT_FOUND'`, `'SERVER_ERROR'` and confirm zero occurrences outside `shared/constants.js`
- [X] T023 [P] Verify SC-003 — search production source files for numeric literal `6` used as room-ID length (e.g., `length !== 6`, `{6}` in room-ID regex) and confirm zero occurrences outside `shared/constants.js`
- [X] T024 [P] Verify SC-004 — confirm each refactored component (`HomePage.jsx`, `RoomPage.jsx`, `Canvas.jsx`, `Toolbar.jsx`) contains no direct `import` from `../services/socket.js`
- [X] T025 [P] Verify SC-005 — confirm `client/tests/unit/useHomePage.test.js` and `client/tests/unit/useCanvasRenderer.test.js` exist and exercise hook logic without mounting a React component

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — run immediately
- **Foundational (Phase 2)**: Depends on Phase 1 baseline ✓ — **BLOCKS all user stories**
- **US1 checkpoint (Phase 3)**: After Foundational — confirms constants additions are clean
- **US2 (Phase 4)**: After Foundational + US1 checkpoint — T004–T007 can run in parallel
- **US3 (Phase 5)**: After US2 completes — write tests first (T009–T010 parallel), then implement sequentially
- **Polish (Final Phase)**: After all user stories complete

### User Story Dependencies

- **US1 (P1)**: Spans all phases as the quality gate; T003 is the post-foundational checkpoint; T021 is the final gate
- **US2 (P2)**: Requires Foundational (T002); T004–T007 are fully independent of each other
- **US3 (P3)**: Requires Foundational (T002) and is easier after US2 (error code constants available in files being restructured); hook implementation tasks (T011–T019) must be sequential

### Within US3

```
T009 + T010 (parallel, TDD-red)
  ↓
T011 → T012 → T013 (GREEN check)
  ↓
T014 → T015 → T016 (GREEN check)
  ↓
T017 → T018 → T019 → T020 (final check)
```

### Parallel Opportunities

| Tasks | Can run in parallel? | Why |
|-------|---------------------|-----|
| T004, T005, T006, T007 | ✅ Yes | Different files, no inter-dependencies |
| T009, T010 | ✅ Yes | Different test files, no inter-dependencies |
| T022, T023, T024, T025 | ✅ Yes | Independent verification steps |

---

## Parallel Example: US2 Literal Replacements

```bash
# All four literal replacement tasks can be launched simultaneously:
Task T004: Replace CONNECTION_STATUS in client/src/services/socket.js
Task T005: Replace CONNECTION_STATUS in client/src/components/ConnectionStatus.jsx
Task T006: Replace ERROR_CODES in server/src/handlers/eventHandlers.js
Task T007: Replace ERROR_CODES in client/src/hooks/useRoom.js
```

## Parallel Example: US3 TDD Test Files

```bash
# Both test files can be written simultaneously:
Task T009: Write client/tests/unit/useHomePage.test.js
Task T010: Write client/tests/unit/useCanvasRenderer.test.js
```

---

## Implementation Strategy

### MVP Scope (This Refactor Has a Single Logical Increment)

Unlike feature additions, this is a pure refactor — all three user stories form one coherent quality improvement. The recommended delivery order is:

1. **Complete Phase 1 + 2**: Baseline + constants foundation
2. **Complete Phase 3 + 4 (US1 gate + US2)**: All literal replacements — independently reviewable increment
3. **Complete Phase 5 (US3)**: Hook extractions — the structural SOC improvement
4. **Complete Final Phase**: Full validation and quality sign-off

### Incremental Checkpoints

At each bold checkpoint above, the full client + server test suite must be green. E2E requires a running server — run E2E only at T001 (baseline) and T021 (final gate).

---

## Notes

- `[P]` tasks = different files, no incomplete-task dependencies — safe to parallelize
- `[Story]` label maps each task to its user story for traceability
- **Never skip a test checkpoint** — a failing test signals a regression that must be fixed before continuing
- Do not modify any existing test file — if an existing test fails after a change, fix the production code, not the test
- Commit after each logical group (e.g., after T002, after T004–T008, after each hook implementation)
- The `shared/` package is a CommonJS/ESM hybrid — verify `import`/`require` style is consistent after T002
