# Tasks: CoollaBoard MVP

**Input**: Design documents from `/specs/001-coollaboard-mvp/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/socket-events.md ✅, quickstart.md ✅

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story. Per Constitution Principle I, **test tasks appear before implementation tasks within every phase** — tests must be written and failing (Red) before any implementation begins.

## Format: `[ID] [P?] [Story?] Description (file path)`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Monorepo initialization, workspace scaffolding, and tooling configuration

- [ ] T001 Create monorepo root package.json with npm workspaces declaring client, server, shared, e2e workspaces (package.json)
- [ ] T002 [P] Scaffold client workspace: package.json with React 18 + Vite 5 + Vitest + React Testing Library deps, vite.config.js with /socket.io proxy to :3001, index.html entry (client/package.json, client/vite.config.js, client/index.html)
- [ ] T003 [P] Scaffold server workspace: package.json with Socket.IO 4, Jest, nodemon dev scripts — use Node.js built-in crypto.randomUUID() for all ID generation, no uuid package dependency (server/package.json)
- [ ] T004 [P] Scaffold e2e workspace: package.json with Playwright, playwright.config.js targeting http://localhost:5173 (e2e/package.json, e2e/playwright.config.js)
- [ ] T005 Create all source directory trees per implementation plan: client/src/{components,hooks,services,tools,utils}, client/tests/{unit,integration}, server/src/{handlers,services,utils}, server/tests/{unit,integration}, shared/, e2e/

**Checkpoint**: `npm install` succeeds from repo root; all workspace dev scripts are resolvable

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared constants, server bootstrap, and client entry point — required by every user story

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T006 Create shared constants: EVENTS, SERVER_EVENTS, OP_TYPE, VIRTUAL_WIDTH/HEIGHT, BRUSH_WIDTH, ERASER_RADIUS, STROKE_COLOR, ROOM_ID_LENGTH, ROOM_ID_ALPHABET, ROOM_GRACE_PERIOD_MS (shared/constants.js)
- [ ] T007 Implement structured JSON logger: timestamped entries with level, roomId, userId, event, durationMs fields; exported as default logger instance (server/src/utils/logger.js)
- [ ] T008 Initialize Node.js HTTP server, attach Socket.IO 4 instance with CORS for http://localhost:5173, import and invoke event handler registration function from server/src/handlers/eventHandlers.js (server/index.js)
- [ ] T009 [P] Create React 18 application entry point rendering root App component; App holds page-state (no roomId = HomePage, roomId set = RoomPage) and passes navigation callbacks (client/src/main.jsx, client/src/App.jsx)
- [ ] T010 [P] Implement virtual-to-screen coordinate helpers: toVirtual(screenX, screenY, canvasEl) and toScreen(virtualX, virtualY, canvasEl) with letterbox scaling for 1920×1080 virtual space (client/src/utils/coordinates.js)

**Checkpoint**: `npm run dev` starts server on :3001 and client on :5173 (blank pages, no console errors); `import { EVENTS } from 'shared/constants.js'` resolves from both client and server

---

## Phase 3: User Story 1 — Room Creation and Joining (Priority: P1) 🎯 MVP

**Goal**: Users can create a new drawing room or join an existing one by entering a room ID. Both tabs are connected to the same shared canvas session.

**Independent Test**: Open the app → create a room → copy the room ID → open a second tab → enter the room ID → verify both tabs display the same empty canvas with no errors

### Tests for User Story 1

> ⚠️ **TDD REQUIREMENT (Constitution Principle I)**: Write ALL tests in this section FIRST. Confirm they FAIL (Red) before beginning any implementation task. Do not begin T017 until T011–T016 are written and failing.

- [ ] T011 [P] [US1] Write unit tests for roomService (all FAIL — Red): createRoom() returns 6-char A–Z0–9 ID; getRoom() returns null for unknown roomId; addOperation() appends and deduplicates on operationId; TTL eviction timer fires after ROOM_GRACE_PERIOD_MS (server/tests/unit/roomService.test.js)
- [ ] T012 [P] [US1] Write integration tests for room:create and room:join handlers (all FAIL — Red): room:create acks {ok:true, roomId, userId}; room:join known room acks {ok:true, operations:[]}; room:join unknown room acks {ok:false, error:'ROOM_NOT_FOUND'}; delta via lastSequence returns only ops with sequenceNumber > lastSequence (server/tests/integration/roomHandlers.test.js)
- [ ] T013 [P] [US1] Write unit tests for socket.js adapter (all FAIL — Red): createRoom() resolves with {roomId, userId}; joinRoom(roomId) resolves with {operations:[]}; joinRoom() for unknown room rejects with ROOM_NOT_FOUND; onConnectionStatus callback fires on connect (client/tests/unit/socket.test.js)
- [ ] T014 [P] [US1] Write unit tests for useRoom hook (all FAIL — Red): mounts and calls createRoom; stores roomId and userId in state; calls joinRoom when roomId prop provided; cleans up socket listeners on unmount (client/tests/unit/useRoom.test.js)
- [ ] T015 [P] [US1] Write component tests for HomePage (all FAIL — Red): Create Room button calls createRoom; 5-char input shows inline error before any request; non-alphanumeric chars show inline error; lowercase input is silently uppercased; ROOM_NOT_FOUND error displays message; valid 6-char ID submits cleanly (client/tests/unit/HomePage.test.jsx)
- [ ] T016 [P] [US1] Write component tests for ConnectionStatus (all FAIL — Red): renders 'Connected' badge on connect event; renders 'Reconnecting' on reconnect_attempt; renders 'Disconnected' on disconnect (client/tests/unit/ConnectionStatus.test.jsx)

### Implementation for User Story 1

- [ ] T017 [US1] Implement roomService: createRoom() generating 6-char A–Z0–9 ID via crypto.randomUUID()-seeded selection, getRoom(roomId), addOperation() with operationId deduplication, TTL eviction timer using ROOM_GRACE_PERIOD_MS (start/cancel on connect/disconnect) (server/src/services/roomService.js)
- [ ] T018 [US1] Implement room:create and room:join socket event handlers: room:create ack returns {ok, roomId, userId} (userId is the server-assigned UUID for this session); room:join ack returns {ok, operations[]} with userId; delta support via lastSequence; room not found returns {ok:false, error:'ROOM_NOT_FOUND'} (server/src/handlers/eventHandlers.js)
- [ ] T019 [P] [US1] Implement socket.js client adapter: singleton Socket.IO connection to http://localhost:3001; createRoom() promise resolving {roomId, userId}; joinRoom(roomId, lastSequence?) promise resolving {operations}; expose onConnectionStatus(cb) subscription helper (client/src/services/socket.js)
- [ ] T020 [US1] Implement useRoom hook: invoke createRoom or joinRoom on mount, store roomId and userId in state, manage socket join lifecycle and cleanup on unmount (client/src/hooks/useRoom.js)
- [ ] T021 [US1] Implement HomePage: "Create Room" button calling createRoom, "Join Room" input with client-side format validation (6-char A–Z0–9, silent uppercase normalisation, inline error for invalid format), server ROOM_NOT_FOUND error message display (client/src/components/HomePage.jsx)
- [ ] T022 [US1] Implement RoomPage: display room ID badge, mount ConnectionStatus in fixed corner, render Canvas and Toolbar component shells (files exist but not yet functional; fleshed out in Phase 4), handle room-not-found redirect to HomePage with "room no longer exists" message (client/src/components/RoomPage.jsx)
- [ ] T023 [P] [US1] Implement ConnectionStatus: fixed-position badge (bottom-right corner) showing Connected / Reconnecting / Disconnected; subscribes to onConnectionStatus from socket.js; updates within 1 second of socket state change (client/src/components/ConnectionStatus.jsx)
- [ ] T024 [US1] Wire App.jsx: render HomePage when roomId is null, render RoomPage when roomId is set; pass onRoomJoined and onLeaveRoom navigation callbacks down through component tree (client/src/App.jsx)

**Checkpoint**: All Phase 3 tests pass (Green). User Story 1 independently functional — create a room from tab 1, join via room ID from tab 2, both tabs show the same empty canvas; ConnectionStatus shows Connected; invalid room IDs show inline validation errors

---

## Phase 4: User Story 2 — Real-Time Freehand Drawing (Priority: P1)

**Goal**: Multiple users in the same room can draw freehand strokes on the canvas that appear on all participants' canvases in real time within 1 second.

**Independent Test**: Two tabs in the same room — draw a stroke in tab 1, verify it appears in tab 2 within 1 s; draw in tab 2, verify in tab 1; a new joiner sees all previously drawn strokes

### Tests for User Story 2

> ⚠️ **TDD REQUIREMENT (Constitution Principle I)**: Write ALL tests in this section FIRST. Confirm they FAIL (Red) before beginning any implementation task. Do not begin T029 until T025–T028 are written and failing.

- [ ] T025 [US2] Write integration tests for draw:stroke handler (all FAIL — Red): valid DRAW stroke appended to Room.operations with server-assigned sequenceNumber; duplicate operationId silently discarded; draw:broadcast emitted to room excluding sender; ERASE type also accepted and processed identically (server/tests/integration/drawHandlers.test.js)
- [ ] T026 [P] [US2] Write unit tests for penTool (all FAIL — Red): pointerdown/move/up sequence accumulates virtual-space points; emits draw:stroke with type:'DRAW', UUID v4 operationId from crypto.randomUUID(), ≥2 points; returns local operation for optimistic render (client/tests/unit/penTool.test.js)
- [ ] T027 [P] [US2] Write unit tests for useCanvas hook (all FAIL — Red): addOperation appends to operations array; convergence algorithm discards all ops at or before last CLEAR index; DRAW ops replayed in sequenceNumber order; draw:broadcast listener appends remote ops (client/tests/unit/useCanvas.test.js)
- [ ] T028 [P] [US2] Write E2E tests for two-tab drawing sync (all FAIL — Red): stroke drawn in tab 1 appears in tab 2 within 1 s; stroke drawn in tab 2 appears in tab 1; new third tab joining sees all prior strokes rendered (e2e/drawing.spec.js)

### Implementation for User Story 2

- [ ] T029 [US2] Extend eventHandlers.js: handle draw:stroke — validate socket is in a room, validate type is DRAW or ERASE (this single handler serves both US2 and US3 at the server layer), deduplicate operationId via crypto.randomUUID()-generated IDs, assign sequenceNumber (Room.nextSequence++), append DrawingOperation to Room.operations, broadcast draw:broadcast to room excluding sender, log structured JSON with durationMs (server/src/handlers/eventHandlers.js)
- [ ] T030 [P] [US2] Implement penTool: pointerdown begins stroke, pointermove converts screen coords to virtual via coordinates.js and accumulates points, pointerup calls crypto.randomUUID() for operationId and emits draw:stroke {operationId, type:'DRAW', points}, returns local operation for optimistic render (client/src/tools/penTool.js)
- [ ] T031 [P] [US2] Implement useCanvas hook: operations array state, addOperation(op) append, convergence replay algorithm (locate last CLEAR index → discard all ops at or before that index → replay remaining DRAW/ERASE ops in sequenceNumber order), canvas dirty flag, draw:broadcast listener calling addOperation for remote strokes (client/src/hooks/useCanvas.js)
- [ ] T032 [P] [US2] Implement Toolbar component: pen tool selector button with visual active state; accepts activeTool prop and onToolChange callback (client/src/components/Toolbar.jsx)
- [ ] T033 [US2] Implement Canvas component: canvas element filling container with letterbox scaling, coordinate conversion via toVirtual/toScreen, pointer event handlers routing to penTool when activeTool=pen, requestAnimationFrame render loop with dirty-flag pattern invoking convergence replay from useCanvas (client/src/components/Canvas.jsx)

**Checkpoint**: All Phase 4 tests pass (Green). User Story 2 independently functional — two tabs draw simultaneously with both strokes appearing on both canvases without loss; a new joiner receives and renders full canvas state via room:join operations replay

---

## Phase 5: User Story 3 — Erase Tool (Priority: P2)

**Goal**: A user can switch to the erase tool and erase portions of drawn content; the erasure is broadcast to all participants in real time.

**Independent Test**: One user draws a stroke, switches to erase tool, erases a portion — verify erased area is cleared locally and the erasure appears on a second tab within 1 s

### Tests for User Story 3

> ⚠️ **TDD REQUIREMENT (Constitution Principle I)**: Write ALL tests in this section FIRST. Confirm they FAIL (Red) before beginning any implementation task. Do not begin T036 until T034–T035 are written and failing.

- [ ] T034 [P] [US3] Write unit tests for eraserTool (all FAIL — Red): mirrors penTool tests; emits type:'ERASE'; points represent eraser centre path in virtual space; operationId is UUID v4 from crypto.randomUUID(); ≥1 point required (client/tests/unit/eraserTool.test.js)
- [ ] T035 [P] [US3] Write unit tests for useCanvas ERASE rendering (all FAIL — Red): ERASE operation in operations array triggers clearRect at each eraser-path point with diameter = ERASER_RADIUS*2; ERASE ops not rendered as strokes (client/tests/unit/useCanvas.test.js)

### Implementation for User Story 3

- [ ] T036 [P] [US3] Implement eraserTool: mirrors penTool structure; pointerdown/move/up collect virtual-space eraser centre points; calls crypto.randomUUID() for operationId; emits draw:stroke {operationId, type:'ERASE', points} on pointerup (client/src/tools/eraserTool.js)
- [ ] T037 [P] [US3] Update Toolbar: add erase tool selector button alongside pen button with independent active visual state (client/src/components/Toolbar.jsx)
- [ ] T038 [US3] Update Canvas to route pointer events to eraserTool when activeTool=erase; update useCanvas replay to render ERASE operations as canvas clearRect calls using ERASER_RADIUS constant for each point along the erase path (client/src/components/Canvas.jsx, client/src/hooks/useCanvas.js)

**Checkpoint**: All Phase 5 tests pass (Green). User Story 3 independently functional — erase tool clears drawn content locally and propagates to all room participants in real time

---

## Phase 6: User Story 4 — Clear Canvas (Priority: P2)

**Goal**: Any room participant can clear the entire shared canvas for all users simultaneously after a confirmation step.

**Independent Test**: Two tabs with drawings — one clicks Clear Canvas, confirms the in-UI dialog — both canvases become blank immediately; cancelling the dialog leaves the canvas unchanged

### Tests for User Story 4

> ⚠️ **TDD REQUIREMENT (Constitution Principle I)**: Write ALL tests in this section FIRST. Confirm they FAIL (Red) before beginning any implementation task. Do not begin T043 until T039–T042 are written and failing.

- [ ] T039 [US4] Write integration tests for canvas:clear handler (all FAIL — Red): valid canvas:clear appends CLEAR op with sequenceNumber; canvas:cleared broadcast to all sockets including sender; duplicate operationId silently discarded (server/tests/integration/clearHandlers.test.js)
- [ ] T040 [P] [US4] Write unit tests for clearTool (all FAIL — Red): emitClear() calls crypto.randomUUID() for operationId; emits CANVAS_CLEAR event with operationId (client/tests/unit/clearTool.test.js)
- [ ] T041 [P] [US4] Write component tests for Toolbar + ConfirmDialog (all FAIL — Red): clicking Clear Canvas renders inline ConfirmDialog; clicking Confirm calls emitClear; clicking Cancel hides dialog without calling emitClear (client/tests/unit/Toolbar.test.jsx)
- [ ] T042 [P] [US4] Write E2E tests for clear canvas (all FAIL — Red): two tabs with drawings; one user confirms clear via in-UI dialog; both canvases become blank immediately; cancelling dialog leaves canvas unchanged (e2e/drawing.spec.js)

### Implementation for User Story 4

- [ ] T043 [US4] Extend eventHandlers.js: handle canvas:clear — validate socket is in a room, deduplicate operationId, assign sequenceNumber, append {type:'CLEAR', points:[]} DrawingOperation, broadcast canvas:cleared to entire room (including sender), log structured JSON (server/src/handlers/eventHandlers.js)
- [ ] T044 [P] [US4] Implement clearTool: call crypto.randomUUID() for operationId, emit EVENTS.CANVAS_CLEAR with {operationId} as fire-and-forget; export as emitClear() (client/src/tools/clearTool.js)
- [ ] T045 [P] [US4] Implement ConfirmDialog component: renders inline "Are you sure? / Confirm / Cancel" UI; accepts onConfirm and onCancel props; controlled visibility via parent state; fully testable without browser-native dialogs (client/src/components/ConfirmDialog.jsx)
- [ ] T046 [P] [US4] Update Toolbar: add Clear Canvas button that toggles ConfirmDialog inline; call clearTool.emitClear() on confirm; hide ConfirmDialog on cancel; import ConfirmDialog (client/src/components/Toolbar.jsx)
- [ ] T047 [US4] Update useCanvas: listen for canvas:cleared server event; append CLEAR operation to operations array; mark canvas dirty so next animation frame re-runs convergence algorithm (discarding all ops before the new CLEAR) (client/src/hooks/useCanvas.js)

**Checkpoint**: All Phase 6 tests pass (Green). User Story 4 independently functional — inline ConfirmDialog shows on Clear Canvas; empties canvas for all participants when confirmed; cancelling leaves canvas unchanged; in-progress stroke at time of clear is discarded

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Reconnection resilience, room-expiry error handling, and delta-hydration — completing the full MVP experience

### Tests for Polish Phase

> ⚠️ **TDD REQUIREMENT (Constitution Principle I)**: Write ALL tests in this section FIRST. Confirm they FAIL (Red) before beginning T049.

- [ ] T048 [P] Write E2E tests for reconnection and delta-hydration (all FAIL — Red): socket disconnects during active session; UI shows 'Reconnecting' within 1 s; on reconnect, canvas state is restored via delta-hydration (only ops since lastSequence replayed); UI returns to 'Connected'; expired room redirects to HomePage with "room no longer exists" message (e2e/room.spec.js)

### Implementation for Polish Phase

- [ ] T049 [P] Configure Socket.IO client with exponential-backoff reconnection (reconnection: true, reconnectionDelay: 1000, reconnectionDelayMax: 10000); bind connect/disconnect/reconnect_attempt events to emit connectionStatus ('Connected'/'Reconnecting'/'Disconnected') to registered onConnectionStatus callbacks (client/src/services/socket.js)
- [ ] T050 [P] Handle room error and expiry in useRoom: listen for room:error events; on ROOM_NOT_FOUND after initial join or on reconnect with expired room, clear roomId state and call onLeaveRoom with message='room no longer exists' rendered on HomePage (client/src/hooks/useRoom.js)
- [ ] T051 Implement delta-hydration on reconnect: on socket reconnect event, call joinRoom(roomId, lastSequence) where lastSequence is the highest sequenceNumber in the local operations array; merge returned delta ops into existing useCanvas operations array without clearing history — depends on T031 (client/src/hooks/useRoom.js, client/src/services/socket.js)

**Checkpoint**: Full MVP complete — all 4 user stories functional with resilient reconnection, delta-hydration on rejoin, ConnectionStatus updating in real time, and graceful room-expiry messaging

---

## Dependency Graph

```
Phase 1 (Setup — T001–T005)
    └─▶ Phase 2 (Foundational — T006–T010: shared constants, server bootstrap, React entry)
            └─▶ Phase 3 (US1 — tests T011–T016 [Red], impl T017–T024 [Green])
                    └─▶ Phase 4 (US2 — tests T025–T028 [Red], impl T029–T033 [Green])
                    │       ├─▶ Phase 5 (US3 — tests T034–T035 [Red], impl T036–T038 [Green])
                    │       └─▶ Phase 6 (US4 — tests T039–T042 [Red], impl T043–T047 [Green])
                    │
                    └─▶ Phase 7 (Polish — test T048 [Red], impl T049–T051 [Green])
                             T051 also depends on T031 (useCanvas operations array)
```

**Story independence**: US3 and US4 both depend on the draw pipeline from Phase 4 (Canvas, useCanvas, eventHandlers) but do not depend on each other — can be implemented in parallel once Phase 4 is complete.

---

## Parallel Execution Examples

### Phase 1 — three-way parallel
```
T002 (client scaffold) ║ T003 (server scaffold) ║ T004 (e2e scaffold)
→ T005 after T001 is done
```

### Phase 2 — parallel pair
```
T009 (React entry + App.jsx) ║ T010 (coordinates.js)
```

### Phase 3 — all tests parallel, then implementation
```
T011 ║ T012 ║ T013 ║ T014 ║ T015 ║ T016  (write tests — all Red)
→ T017 (roomService) ║ T019 (socket.js) ║ T023 (ConnectionStatus)
→ T018 (event handlers, needs T017) ║ T020 / T021 / T022 (need T019)
→ T024 (App.jsx wiring, needs T020–T023)
```

### Phase 4 — tests parallel, then implementation
```
T025 ║ T026 ║ T027 ║ T028  (write tests — all Red)
→ T029 (draw:stroke handler)
→ T030 (penTool) ║ T031 (useCanvas) ║ T032 (Toolbar)
→ T033 (Canvas, integrates all three)
```

### Phase 5 + 6 — parallel phases after Phase 4
```
Phase 5: T034 ║ T035 → T036 ║ T037 → T038
Phase 6: T039 ║ T040 ║ T041 ║ T042 → T043 → T044 ║ T045 ║ T046 → T047
```

### Phase 7 — test then parallel implementation
```
T048 (E2E reconnection test — Red)
→ T049 (reconnection config) ║ T050 (room error handling) → T051 (delta-hydration)
```

---

## Implementation Strategy

### MVP Scope (Minimum Viable Increment)
Phase 3 alone (User Story 1) constitutes the true MVP: users can share a room and see the same blank canvas. All drawing capabilities build on this foundation.

### Incremental Delivery Order
1. **Phases 1–2** — Infrastructure: nothing user-visible yet
2. **Phase 3** ← MVP gate: Room creation and joining working end-to-end
3. **Phase 4** ← Core value: Real-time freehand drawing synchronized across tabs
4. **Phases 5 + 6** — Erase and clear tools (parallel after Phase 4)
5. **Phase 7** — Resilience and polish (can overlap with Phases 5 + 6)

### Key Implementation Notes
- **TDD is mandatory (Constitution I)**: Write all test tasks in a phase first, run them and confirm Red, then implement. Do not skip ahead.
- `shared/constants.js` (T006) must exist before any module that imports from it
- `roomService.js` (T017) must be complete before `eventHandlers.js` room handlers (T018)
- UUID generation: use `crypto.randomUUID()` throughout — no `uuid` npm package (research.md §2 decision)
- The `room:create` and `room:join` acks both return `userId` (server-assigned UUID) so the client can track its own session identity
- The `draw:stroke` server handler (T029) handles both `DRAW` and `ERASE` type operations — no separate server handler is needed for Phase 5
- The `useCanvas.js` convergence algorithm: find last CLEAR op index → discard all ops at or before that index → replay remaining DRAW/ERASE ops in sequenceNumber order
- Confirmation step for Clear Canvas uses an inline `ConfirmDialog` component (not `window.confirm`) to remain unit-testable with Vitest/RTL
- `socket.js` must be a singleton module to avoid duplicate Socket.IO connections across React re-renders
- All drawing coordinates must be converted to virtual space (1920×1080) before emitting and back to screen pixels only at render time
- `T051` (delta-hydration) depends on `T031` (useCanvas operations array state) being complete
