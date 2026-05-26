# Tasks: Lift Canvas State to RoomPage

**Input**: Design documents from `specs/007-lift-canvas-state/`
**Prerequisites**: [plan.md](plan.md) · [spec.md](spec.md) · [research.md](research.md) · [data-model.md](data-model.md)

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Exact file paths included in every task description

---

## Phase 1: Setup

**Purpose**: Confirm the branch and test baseline before any code changes.

- [X] T001 Verify all existing client unit tests pass: `cd client && npm test`
- [X] T002 Verify all server integration tests pass: `cd server && npm test`

**Checkpoint**: Green baseline confirmed — no pre-existing failures.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Extend `useCanvas` with the `initialOperations` parameter. This change is the prerequisite for all three user stories because `RoomPage` depends on it to seed state without a hydration `useEffect`.

**⚠️ CRITICAL**: All user story work depends on this phase being complete first.

- [X] T003 Add unit test for `initialOperations` param in `client/tests/unit/useCanvas.test.js` — verify hook initialises with the provided operations and deduplicates correctly (write test first; confirm it fails before T004)
- [X] T004 Add `initialOperations` param to `useCanvas` — change `useState([])` to `useState(initialOperations ?? [])` in `client/src/hooks/useCanvas.js` (implement after T003 is red)

**Checkpoint**: `useCanvas` accepts seed data; `npm test` still green.

---

## Phase 3: User Story 1 — Consistent Collaborative Drawing State (Priority: P1) 🎯 MVP

**Goal**: A single operations list owned by `RoomPage` drives both rendering and server-sync. The duplicate `useState(initialOperations)` in `RoomPage` and the `useCanvas()` call inside `Canvas` are eliminated.

**Independent Test**: Open a room, draw three strokes, receive a remote broadcast, undo twice — the canvas renders correctly, the undo/redo buttons reflect the right state, and no duplicate operations appear.

### Implementation for User Story 1

- [X] T005 [US1] Move `useCanvas` call to `RoomPage` — add `const { operations, addOperation, removeOperation, getVisibleOperations } = useCanvas(initialOperations)` in `client/src/components/RoomPage.jsx`
- [X] T006 [US1] Remove duplicate `useState(initialOperations)` and `addOperations` callback from `RoomPage` in `client/src/components/RoomPage.jsx`
- [X] T007 [US1] Move `useUndoRedo` call to `RoomPage` — add `const { canUndo, canRedo, requestUndo, requestRedo } = useUndoRedo({ removeOperation, addOperation })` in `client/src/components/RoomPage.jsx`
- [X] T008 [US1] Update `useRoom` call in `RoomPage` to pass `addOperations: (ops) => ops.forEach(addOperation)` (thin wrapper for reconnect delta) and `operations` — `useRoom`'s own interface is unchanged; `useCanvas` retains its `CANVAS_CLEARED` subscription internally, in `client/src/components/RoomPage.jsx`
- [X] T009 [US1] Add a dedicated `CANVAS_CLEARED` `useEffect` in `RoomPage` (separate from `useCanvas`'s internal subscription) that calls `onExternalClearRef.current?.()` to flush Canvas previews, in `client/src/components/RoomPage.jsx`
- [X] T010 [US1] Pass `onExternalClear`, `addOperation`, `removeOperation`, `getVisibleOperations`, `canUndo`, `canRedo`, `requestUndo`, `requestRedo` as props to `<Canvas>` in `client/src/components/RoomPage.jsx`
- [X] T011 [US1] Remove `onToolChange`, `onClear`, `onColorChange`, `onBrushSizeChange`, `initialOperations` props from the `<Canvas>` call site in `client/src/components/RoomPage.jsx`

**Checkpoint**: `RoomPage` owns all collaborative state; single operations list in place.

---

## Phase 4: User Story 2 — Pure Rendering Canvas Component (Priority: P2)

**Goal**: `Canvas` accepts all state as props and calls `addOperation` directly on pointer-up. It imports neither `useCanvas` nor `useUndoRedo` and does not render `Toolbar`.

**Independent Test**: Render `Canvas` with static props in a unit test (no socket mock needed) — strokes render without any room/socket context.

### Implementation for User Story 2

- [X] T012 [US2] Update `Canvas` prop signature — add `addOperation`, `removeOperation`, `getVisibleOperations`, `canUndo`, `canRedo`, `requestUndo`, `requestRedo`, `onExternalClear` to the destructured props. Do NOT add a raw `operations` prop — `Canvas` calls `getVisibleOperations()` directly for rendering, in `client/src/components/Canvas.jsx`
- [X] T013 [US2] Remove `useCanvas()` call and its destructuring from `client/src/components/Canvas.jsx`
- [X] T014 [US2] Remove `useUndoRedo()` call and its destructuring from `client/src/components/Canvas.jsx`
- [X] T015 [US2] Wire `onExternalClear` prop to `clearAllPreviews` via a ref — add `const onExternalClearRef = useRef(onExternalClear); useEffect(() => { onExternalClearRef.current = onExternalClear; }, [onExternalClear]);` and ensure preview-flush is called via `onExternalClearRef.current?.()`, in `client/src/components/Canvas.jsx`
- [X] T016 [US2] Remove the `useEffect` that calls `clearAllPreviews` on `CANVAS_CLEARED` from `client/src/components/Canvas.jsx` (now handled in RoomPage)
- [X] T017 [US2] Remove the hydration `useEffect` (the one iterating `initialOperations`) from `client/src/components/Canvas.jsx`
- [X] T018 [US2] Remove `initialOperations` and tool-callback props (`onToolChange`, `onClear`, `onColorChange`, `onBrushSizeChange`) from the `Canvas` function signature in `client/src/components/Canvas.jsx`
- [X] T019 [US2] Remove `import { useCanvas }`, `import { useUndoRedo }`, and `import Toolbar` from `client/src/components/Canvas.jsx`

**Checkpoint**: `Canvas.jsx` imports are clean; all pointer handlers work through props.

---

## Phase 5: User Story 3 — RoomPage as Single Collaborative State Owner (Priority: P3)

**Goal**: `Toolbar` is a direct sibling of `Canvas` inside `RoomPage`. `Canvas` no longer renders `Toolbar`. The component tree visually and structurally reflects `RoomPage` as the single collaborative state owner.

**Independent Test**: Inspect the rendered tree — `Toolbar` is a direct child of `RoomPage`'s `.room-page__canvas-area`, not a descendant of `Canvas`.

### Implementation for User Story 3

- [X] T020 [US3] Add `import Toolbar from './Toolbar.jsx'` to `client/src/components/RoomPage.jsx`
- [X] T021 [US3] Render `<Toolbar>` inside `.room-page__canvas-area` as a sibling of `<Canvas>` — pass `activeTool`, `onToolChange`, `onClear={handleClear}`, `color`, `onColorChange`, `brushSize`, `onBrushSizeChange`, `canUndo`, `canRedo`, `onUndo={requestUndo}`, `onRedo={requestRedo}` in `client/src/components/RoomPage.jsx`
- [X] T022 [US3] Remove `<Toolbar>` render and all its props from `client/src/components/Canvas.jsx` (should already be gone from US2 import removal — verify and remove JSX)
- [X] T023 [US3] Verify `.canvas-wrapper` in `Canvas` now wraps only the two `<canvas>` elements in `client/src/components/Canvas.jsx`

**Checkpoint**: React DevTools shows `Toolbar` as sibling of `Canvas` under `RoomPage`.

---

## Phase 6: Polish & Validation

**Purpose**: Confirm all tests pass, no regressions, and the implementation matches the spec.

- [X] T024 [P] Run full client unit test suite and confirm all 14 test files pass: `cd client && npm test`
- [X] T025 [P] Run server integration tests and confirm all pass: `cd server && npm test`
- [ ] T026 Manual smoke test per [quickstart.md](quickstart.md) — draw, receive remote stroke, undo, redo, clear in a live room
- [X] T027 Confirm `Canvas.jsx` no longer imports `useCanvas`, `useUndoRedo`, or `Toolbar` (grep check: `grep -n "useCanvas\|useUndoRedo\|Toolbar" client/src/components/Canvas.jsx`)
- [X] T028 Confirm `RoomPage.jsx` no longer has a duplicate `useState(initialOperations)` or `addOperations` array-merge callback (grep check: `grep -n "addOperations\|useState(initial" client/src/components/RoomPage.jsx`)
- [ ] T029 [P] Run E2E tests to validate full collaborative session — `cd e2e && npx playwright test` (covers SC-005 with automated multi-user draw, undo/redo, sync per constitution Principle I)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 baseline — BLOCKS all user stories
- **Phase 3 (US1)**: Depends on Phase 2 — modifies `RoomPage`
- **Phase 4 (US2)**: Depends on Phase 3 — modifies `Canvas` to consume props set up in Phase 3
- **Phase 5 (US3)**: Depends on Phase 3 + Phase 4 — final layout wiring
- **Phase 6 (Polish)**: Depends on all above

### User Story Dependencies

- **US1 (P1)**: After Phase 2. RoomPage gets state; Canvas still has its own hooks (temporarily broken state — ship Phase 3 + Phase 4 atomically)
- **US2 (P2)**: After US1. Canvas removes its hooks and receives props that US1 set up.
- **US3 (P3)**: After US1 + US2. Toolbar moves to RoomPage and is wired with the state from US1.

> **Note**: US1 + US2 form an atomic change pair — the app will not compile cleanly if only US1 is applied (Canvas still imports old hooks) or only US2 (Canvas expects props that aren't passed yet). Implement Phases 3 and 4 in a single commit.

### Parallel Opportunities

- T001 and T002 (baseline tests) can run in parallel
- T024 and T025 (final validation tests) can run in parallel
- Within Phase 3: T005–T008 are changes to different logical sections of `RoomPage.jsx` and can be authored together
- Within Phase 4: T012–T019 are all `Canvas.jsx` changes and can be authored together

---

## Parallel Example: Phases 3 + 4 (atomic commit)

```
# Author all RoomPage changes (T005–T011) together
# Author all Canvas changes (T012–T019) together
# Commit both together as a single atomic refactor
git add client/src/components/RoomPage.jsx client/src/components/Canvas.jsx
git commit -m "lift: move useCanvas + useUndoRedo to RoomPage; Canvas is now stateless"
```

---

## Implementation Strategy

**MVP scope**: All three user stories form a single cohesive refactor — there is no partial MVP since US1 (RoomPage gets state) and US2 (Canvas removes state) must be shipped atomically. The smallest deployable unit is Phases 2 + 3 + 4 together.

**Incremental delivery**:
1. Phase 2 — `useCanvas` gains `initialOperations` param (safe, backward-compatible, independently testable)
2. Phases 3 + 4 — atomic RoomPage/Canvas swap (must be done together)
3. Phase 5 — Toolbar relocation (independent, can be a separate commit)
4. Phase 6 — Validation

**Total tasks**: 29  
**Tasks per story**: US1 = 7, US2 = 8, US3 = 4  
**Foundational**: 2  
**Setup/Polish**: 8  
**Parallel opportunities**: T001/T002, T024/T025/T029, within-phase batching of RoomPage and Canvas changes
