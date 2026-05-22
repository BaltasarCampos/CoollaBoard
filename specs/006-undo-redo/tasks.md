---

description: "Task list for 006-undo-redo feature implementation"
---

# Tasks: Collaborative Undo / Redo

**Input**: Design documents from `specs/006-undo-redo/`
**Prerequisites**: plan.md ✅, spec.md ✅, data-model.md ✅, contracts/socket-events.md ✅, research.md ✅, quickstart.md ✅

**Tests**: TDD is **required** by the project constitution (Principle I). All test tasks MUST be written and confirmed failing BEFORE their corresponding implementation tasks are started.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Exact file paths included in all descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Add the new socket-event constants that every other phase depends on. This is the single shared prerequisite — all phases block on this file.

- [x] T001 Add EVENTS.UNDO_REQUEST, EVENTS.REDO_REQUEST, SERVER_EVENTS.UNDO_BROADCAST, SERVER_EVENTS.REDO_BROADCAST, SERVER_EVENTS.UNDO_STATE, UNDO_HISTORY_DEPTH = 20, and UNDO_CONFIRM_TIMEOUT_MS = 5000 to shared/constants.js

**Checkpoint**: Constants available to all packages via the shared workspace — server and client can now import the new event names.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core server-side history data structures, roomService helper functions, client socket emitters, and the `removeOperation` primitive in `useCanvas`. These are pre-requisites for every user story — no story phase can begin until this phase is complete.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

### Tests for Foundational Layer ⚠️ Write FIRST — must FAIL before implementation

- [x] T002 Write failing unit tests for pushToUndoStack (cap at 20), clearRedoStack, resolveUndo (personal + clear paths), resolveRedo, getUndoRedoState, and clearUserHistory in server/tests/unit/roomService.test.js
- [x] T003 [P] Write failing unit tests for removeOperation(operationId) deduplication (present ID removed, absent ID is a no-op) in client/tests/unit/useCanvas.test.js

### Implementation for Foundational Layer

- [x] T004 Extend room initializer with userUndoStacks: new Map(), userRedoStacks: new Map(), latestClearEntry: null and implement and export pushToUndoStack, clearRedoStack, resolveUndo, resolveRedo, getUndoRedoState, clearUserHistory in server/src/services/roomService.js
- [x] T005 [P] Add removeOperation(operationId) to client/src/hooks/useCanvas.js filtering the operation from the operations array and expose it in the hook's return value
- [x] T006 [P] Add emitUndoRequest() and emitRedoRequest() (each emitting an empty object payload) to client/src/services/socket.js

**Checkpoint**: Foundation ready — roomService history API is tested and implemented; client has removeOperation and emit helpers. User story implementation can now begin.

---

## Phase 3: User Story 1 — Undo Own Stroke (Priority: P1) 🎯 MVP

**Goal**: A user who has drawn one or more strokes can undo their most recent stroke. The stroke disappears from all participants' canvases in real time. The Undo toolbar button and Ctrl+Z / Cmd+Z keyboard shortcut both trigger the action; the button is visually disabled when no history exists.

**Independent Test**: Have a single user draw a stroke, trigger undo via the toolbar button, and verify the stroke is removed both locally and on a second connected client tab.

### Tests for User Story 1 ⚠️ Write FIRST — must FAIL before implementation

- [x] T007 Write failing integration tests for undo:request handler: DRAW/ERASE stroke undo removes op from room.operations, undo:broadcast emitted to all room sockets, undo:state emitted to originator only, silent no-op when stack is empty, ownership validation silently rejects foreign-stroke undo request, and clearUserHistory called on disconnect in server/tests/integration/undoRedoHandlers.test.js
- [x] T008 [P] Write failing unit tests for useUndoRedo: canUndo updates from undo:state events, requestUndo() emits EVENTS.UNDO_REQUEST, undo:broadcast calls removeOperation, and pending guard prevents double-emit in client/tests/unit/useUndoRedo.test.js
- [x] T009 [P] Write failing unit tests for Toolbar: Undo button renders, onClick fires onUndo prop, button is disabled when canUndo=false in client/tests/unit/Toolbar.test.jsx

### Implementation for User Story 1

- [x] T010 [US1] In server/src/handlers/eventHandlers.js: register undo:request handler for DRAW/ERASE strokes (call resolveUndo, emit undo:broadcast to room and undo:state to originator; log at info with durationMs), call pushToUndoStack after draw:stroke is committed, and call clearUserHistory on socket disconnect
- [x] T011 [US1] Create client/src/hooks/useUndoRedo.js with canUndo/canRedo state (false initially), requestUndo() that emits EVENTS.UNDO_REQUEST and sets a 5-second pending timeout that re-enables the control if no broadcast arrives, and an undo:broadcast socket listener that calls removeOperation and clears pending
- [x] T012 [US1] Add Undo button (label "Undo", disabled={!canUndo}, onClick={onUndo}) to client/src/components/Toolbar.jsx accepting onUndo and canUndo props
- [x] T013 [US1] In client/src/components/Canvas.jsx: call useUndoRedo with removeOperation from useCanvas; pass onUndo and canUndo as props to Toolbar

**Checkpoint**: User Story 1 fully functional and independently testable. A user can undo their own strokes; the change propagates to all connected clients; the Undo button disables when history is empty.

---

## Phase 4: User Story 2 — Clear-Canvas Undone by Any Participant (Priority: P2)

**Goal**: Any user in the room — including users who did not trigger the original clear — can undo a clear-canvas event. When undone, all content present before the clear is restored on every participant's canvas. Pre-clear undo requires no redo (the clear event is fully consumed on undo).

**Independent Test**: Have user A clear the canvas, then have user B (who drew nothing) trigger undo and verify all prior content is restored on both client tabs, with no redo option appearing.

### Tests for User Story 2 ⚠️ Write FIRST — must FAIL before implementation

- [x] T014 Write failing integration tests for clear-canvas undo: any user (not just the clear originator) can undo via latestClearEntry, room-wide undo:state emitted to all sockets after clear undo, latestClearEntry set to null after undo, CLEAR op not placed on redo stack (FR-005), new CLEAR replaces old latestClearEntry, and clear-originator disconnect does not corrupt latestClearEntry or other users' undo:state (latestClearEntry remains set and canUndo remains accurate for remaining participants) in server/tests/integration/undoRedoHandlers.test.js
- [x] T015 [P] Write failing integration tests for undo:state emitted to originator after draw:stroke, undo:state emitted to all room sockets after canvas:clear, and undo:state emitted to joining socket on room:join and room:create in server/tests/integration/drawHandlers.test.js

### Implementation for User Story 2

- [x] T016 [US2] In server/src/handlers/eventHandlers.js: update canvas:clear handler to set room.latestClearEntry and emit undo:state to all room sockets; extend undo:request handler with the clear-undo path (call resolveUndo clear branch, emit undo:broadcast and per-socket undo:state to all room members; log at info with clearedByUserId and durationMs); emit undo:state to the drawing user's socket after draw:stroke
- [x] T017 [US2] In server/src/handlers/eventHandlers.js: emit undo:state (via getUndoRedoState) to the joining socket in room:join and room:create handlers so new participants receive correct canUndo/canRedo on arrival
- [x] T018 [US2] In client/src/hooks/useUndoRedo.js: extend undo:broadcast listener to handle CLEAR type by calling removeOperation(operationId) — removing the CLEAR op from the local operations array causes getVisibleOperations to expose pre-clear ops automatically; also clear pending timeout when userId matches local session

**Checkpoint**: User Stories 1 and 2 both functional. Any user can undo a clear; all participants see the restored canvas; the cleared state cannot be redone.

---

## Phase 5: User Story 3 — Redo Last Undone Action (Priority: P3)

**Goal**: A user who has just undone one or more actions can redo them in forward order. The content reappears on all participants' canvases. Drawing a new stroke after an undo clears the redo stack. The Redo toolbar button and Ctrl+Y / Cmd+Y keyboard shortcut both trigger the action; the button is disabled when no redo history exists.

**Independent Test**: Have a user draw a stroke, undo it (Ctrl+Z), then redo it (Ctrl+Y) and verify the stroke reappears on all connected client tabs; then draw a new stroke and confirm the Redo button becomes disabled.

### Tests for User Story 3 ⚠️ Write FIRST — must FAIL before implementation

- [x] T019 Write failing integration tests for redo:request handler: redo:broadcast emitted to all room sockets with the full operation payload, undo:state emitted to originator, silent no-op when redo stack is empty, and redo stack cleared after a new draw:stroke in server/tests/integration/undoRedoHandlers.test.js
- [x] T020 [P] Write failing unit tests for useUndoRedo: canRedo updates from undo:state events, requestRedo() emits EVENTS.REDO_REQUEST, redo:broadcast calls addOperation with the full operation payload, and clearRedoStack on new draw in client/tests/unit/useUndoRedo.test.js
- [x] T021 [P] Write failing unit tests for Toolbar: Redo button renders, onClick fires onRedo prop, button is disabled when canRedo=false in client/tests/unit/Toolbar.test.jsx

### Implementation for User Story 3

- [x] T022 [US3] In server/src/handlers/eventHandlers.js: register redo:request handler (call resolveRedo, emit redo:broadcast to room and undo:state to originator; log at info with durationMs); call clearRedoStack inside the existing draw:stroke handler when type === OP_TYPE.DRAW or type === OP_TYPE.ERASE to invalidate redo history on any new drawing action (there is no separate eraser:stroke event — both draw and erase share the draw:stroke handler with an OP_TYPE discriminator)
- [x] T023 [US3] In client/src/hooks/useUndoRedo.js: add canRedo state, requestRedo() with 5-second pending timeout guard, and redo:broadcast socket listener that calls addOperation with the full operation and clears pending; expose requestRedo and canRedo from the hook
- [x] T024 [US3] Add Redo button (label "Redo", disabled={!canRedo}, onClick={onRedo}) to client/src/components/Toolbar.jsx accepting onRedo and canRedo props
- [x] T025 [US3] In client/src/components/Canvas.jsx: pass onRedo and canRedo from useUndoRedo as props to Toolbar

**Checkpoint**: All three user stories functional. Full undo/redo cycle works; new drawing clears redo history; Redo button disables correctly.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Keyboard shortcut support (FR-010), E2E multi-user coverage, and quickstart validation.

- [x] T026 Write failing unit tests for keyboard shortcut listeners: Ctrl+Z / Cmd+Z calls requestUndo, Ctrl+Y / Cmd+Y calls requestRedo, Ctrl+Shift+Z / Cmd+Shift+Z calls requestRedo, and listener is removed on hook unmount in client/tests/unit/useUndoRedo.test.js
- [x] T027 [P] Add keyboard shortcut listener on document in client/src/hooks/useUndoRedo.js: attach keydown handler on mount (Ctrl+Z / Cmd+Z → requestUndo; Ctrl+Y / Cmd+Y / Ctrl+Shift+Z / Cmd+Shift+Z → requestRedo); clean up on unmount via useEffect cleanup
- [x] T028 [P] Add multi-user undo/redo/clear E2E scenarios to e2e/drawing.spec.js covering the four quickstart.md manual test scenarios: undo own stroke, redo undone stroke, any user undoes a clear, and toolbar button enabled/disabled states
- [x] T029 [P] Add timing-assertion integration test to server/tests/integration/undoRedoHandlers.test.js: emit undo:request, record timestamp before emit and after undo:broadcast arrives on a second socket, assert the delta is ≤ 1000 ms — covering SC-001 under local socket.io round-trip conditions
- [x] T030 Run quickstart.md validation scenarios manually (all four scenarios) and confirm all acceptance criteria from spec.md pass end-to-end

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 completion — **blocks all user stories**
- **User Story phases (Phase 3, 4, 5)**: All depend on Phase 2 completion
  - US1 (Phase 3) has no dependency on US2 or US3
  - US2 (Phase 4) has no dependency on US1 or US3 (server side is independent; client side builds on useUndoRedo from US1)
  - US3 (Phase 5) builds on useUndoRedo established in US1; toolbar patterns established in US1/US2
  - **Recommended delivery order**: US1 → US2 → US3 (priority and logical progression)
- **Polish (Phase 6)**: Depends on all three user story phases

### User Story Dependencies

- **User Story 1 (P1)**: Starts after Phase 2 — no story dependencies; establishes `useUndoRedo.js` and Toolbar Undo button used by US2 and US3
- **User Story 2 (P2)**: Starts after Phase 2 — server-side clear-undo logic is independent of US1; client-side extends the hook created in US1, so US2 should follow US1 in practice
- **User Story 3 (P3)**: Starts after Phase 2 — extends `useUndoRedo.js` from US1 with redo state and requestRedo; follows US1 and US2

### Within Each User Story

1. Write tests → confirm they FAIL
2. Implement (server handlers, then client hook, then UI components)
3. Confirm tests PASS
4. Manual verification via quickstart.md scenarios

### Parallel Opportunities

- T002 and T003 (server tests + client removeOperation tests) within Phase 2 are independent
- T004 and T005 (roomService impl) are sequential; T005 and T006 can run in parallel (different files)
- T007, T008, T009 (Phase 3 test tasks) are all independent — write in parallel
- T010, T011 (server handler + client hook) are independent files — implement in parallel after all three test tasks pass
- T012, T013 (Toolbar + Canvas UI) are independent within Phase 3 after T011 completes
- T014 and T015 (Phase 4 test tasks) are independent
- T019, T020, T021 (Phase 5 test tasks) are all independent
- T027 and T028 (Phase 6) are independent — keyboard shortcuts and E2E tests can be written in parallel

---

## Parallel Execution Example: User Story 1

```bash
# After Phase 2 is complete, run these concurrently:

# Thread A — Server integration test
# Write failing tests in server/tests/integration/undoRedoHandlers.test.js (T007)
# then implement undo:request handler in server/src/handlers/eventHandlers.js (T010)

# Thread B — Client hook test + implementation
# Write failing tests in client/tests/unit/useUndoRedo.test.js (T008)
# then implement client/src/hooks/useUndoRedo.js (T011)

# Thread C — Toolbar test + implementation
# Write failing tests in client/tests/unit/Toolbar.test.jsx (T009)
# then add Undo button to client/src/components/Toolbar.jsx (T012)

# After T010 + T011 + T012 complete:
# Integrate in client/src/components/Canvas.jsx (T013)
```

---

## Implementation Strategy

**MVP scope (Phase 1 + Phase 2 + Phase 3 only)**:
- Delivers the highest-value user story: users can undo their own strokes in real time
- All other participants see the change immediately
- Toolbar Undo button with correct disabled state
- Fully tested (unit + integration)

**Incremental delivery**:
1. Phase 1 + 2 (constants + foundation): unlocks all stories
2. Phase 3 (US1 — undo own stroke): MVP — ship if needed
3. Phase 4 (US2 — clear undo): adds clear-canvas safety net
4. Phase 5 (US3 — redo): completes the undo/redo contract
5. Phase 6 (keyboard shortcuts + E2E): production polish
