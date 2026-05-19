# Tasks: Live Stroke Preview

**Input**: Design documents from `/specs/005-live-stroke-preview/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/socket-events.md ✅

**Tests**: Included — Constitution Check (Principle I: Test-First/TDD) requires failing tests before all new/modified unit implementations.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2)
- Exact file paths are included in all descriptions

---

## Phase 1: Setup (Shared Constants)

**Purpose**: Add the five new Socket.IO event name constants that every other changed file imports. No user story work can begin until these constants exist.

- [ ] T001 Add EVENTS.STROKE_PREVIEW, EVENTS.STROKE_CANCEL, SERVER_EVENTS.STROKE_PREVIEW_BROADCAST, SERVER_EVENTS.STROKE_CANCEL_BROADCAST, and SERVER_EVENTS.USER_LEFT to shared/constants.js

---

## Phase 2: Foundational (Socket Service Helpers)

**Purpose**: Add the two new client-side emit helpers that the drawing tools (US1) call on every throttled pointer-move and pointer-cancel event. MUST be complete before any tool or server handler work begins.

**⚠️ CRITICAL**: Tool and server handler implementations cannot proceed until this phase is complete.

- [ ] T002 Add emitStrokePreview(payload) and emitStrokeCancel(payload) helper functions to client/src/services/socket.js

**Checkpoint**: Shared constants and socket helpers are ready — user story implementation can now begin.

---

## Phase 3: User Story 1 — Local In-Progress Stroke Rendering (Priority: P1) 🎯 MVP

**Goal**: A drawing user sees their stroke rendered incrementally on the overlay canvas in real time while holding and moving the pointer, before commit. Pointer-cancel discards the preview. Pointer-leave pauses point collection; pointer-enter resumes it.

**Independent Test**: Open a room alone, pick the pen tool, press and drag across the canvas. The stroke line must appear on the canvas in real time as you move — no pointer-up required.

### Tests for User Story 1 ⚠️ Write first — ensure they FAIL before implementation

- [ ] T003 [P] [US1] Update client/tests/unit/penTool.test.js: operationId generated at pointer-down (not pointer-up); throttled preview emission calls emitStrokePreview() at most once per 30 ms; pointer-cancel calls emitStrokeCancel() and clears the local preview; pointer-leave sets insideCanvas to false (stops accumulating points); pointer-enter sets insideCanvas to true (resumes accumulation); onPointerMove returns the current StrokePreview snapshot
- [ ] T004 [P] [US1] Update client/tests/unit/eraserTool.test.js: operationId generated at pointer-down; throttled preview emission calls emitStrokePreview() at most once per 30 ms; pointer-cancel calls emitStrokeCancel() and clears local state; pointer-leave pauses point accumulation (insideCanvas=false); pointer-enter resumes accumulation (insideCanvas=true); onPointerMove returns current StrokePreview snapshot with type=ERASE (no color or brushSize fields); verify emitStrokePreview payload omits color and brushSize when type is ERASE
- [ ] T005 [P] [US1] Create client/tests/unit/usePreviewLayer.test.js: initial previews map is empty; setPreview() upserts entry keyed by operationId; calling setPreview() again for the same operationId replaces the previous entry; removePreview() deletes entry by operationId; clearAllPreviews() empties the entire map; hook exposes setPreview, removePreview, clearAllPreviews, and previews
- [ ] T006 [P] [US1] Update client/tests/unit/useCanvasRenderer.test.js: renderer accepts previewCanvasRef and previews (Map) as additional props; overlay canvas is cleared at the start of each dirty frame before repainting; a DRAW preview entry causes stroke rendering on the preview canvas with correct color and brushSize; an ERASE preview entry causes clearRect calls on the preview canvas; empty previews map results in no paint calls on the overlay canvas

### Implementation for User Story 1

- [ ] T007 [US1] Update client/src/tools/penTool.js: generate operationId via crypto.randomUUID() on pointer-down and store it in tool-local state; accumulate { x, y } virtual coordinate points on every pointer-move; emit throttled stroke:preview via emitStrokePreview() using a Date.now() gate (emit only when Date.now() - lastPreviewAt >= 30, then update lastPreviewAt); on pointer-cancel call emitStrokeCancel({ operationId, userId }) and clear local state; set insideCanvas flag to false on pointer-leave (pause point accumulation) and to true on pointer-enter (resume accumulation); return current { operationId, type, points, color, brushSize } snapshot from onPointerMove so Canvas can call setPreview()
- [ ] T008 [P] [US1] Update client/src/tools/eraserTool.js: apply the same operationId-at-down, throttle gate, cancel/leave/enter, and onPointerMove-snapshot changes as penTool.js
- [ ] T009 [US1] Create client/src/hooks/usePreviewLayer.js: export usePreviewLayer hook; maintain previews as a Map<operationId, StrokePreview> via useRef (stable reference) and a companion state counter to trigger re-renders when the map changes; implement setPreview(preview) (upsert by operationId), removePreview(operationId) (delete by operationId), and clearAllPreviews() (clear entire map); return { previews, setPreview, removePreview, clearAllPreviews } — no socket subscriptions in this task (those are added in T015)
- [ ] T010 [US1] Update client/src/hooks/useCanvasRenderer.js: accept previewCanvasRef and previews (Map) as additional parameters; in the RAF loop add a dedicated preview-canvas branch that runs whenever previews has entries or has changed: clear the full overlay canvas, then iterate all previews and render each using the same renderDraw (strokeStyle, lineWidth, lineCap/lineJoin=round) logic for DRAW type and the same renderErase (clearRect boxes at each scaled point) logic for ERASE type; committed canvas rendering is unchanged
- [ ] T011 [US1] Update client/src/components/Canvas.jsx: wrap both canvas elements in a shared position:relative container div; add previewCanvasRef and render a second overlay <canvas ref={previewCanvasRef}> with style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', width: '100%', height: '100%' }}; call usePreviewLayer() and destructure { previews, setPreview, removePreview, clearAllPreviews }; on onPointerMove call setPreview() with the snapshot returned by the active tool; add onPointerCancel handler that calls removePreview(currentOperationId); add onPointerLeave and onPointerEnter handlers that forward to the active tool's handlers; call removePreview(operationId) on pointer-up before the commit event is emitted; pass previewCanvasRef and previews to useCanvasRenderer

**Checkpoint**: User Story 1 is independently testable. All unit tests for penTool, eraserTool, usePreviewLayer, useCanvasRenderer, and Canvas must pass. Open a solo room and confirm the local stroke preview renders on the overlay canvas in real time during pointer drag.

---

## Phase 4: User Story 2 — Broadcasting In-Progress Stroke to Remote Users (Priority: P2)

**Goal**: All other users in the same room see the drawing user's in-progress stroke appear incrementally on their own preview canvas as the pointer moves. On disconnect, orphaned previews from the departed user are removed from all remote canvases within 5 s.

**Independent Test**: Open the same room in two browser tabs. Press and drag with the pen tool in tab A — the in-progress stroke must appear progressively on tab B's canvas as the pointer moves, before pointer-up.

### Tests for User Story 2 ⚠️ Write first — ensure they FAIL before implementation

- [ ] T012 [US2] Update server/tests/integration/drawHandlers.test.js: stroke:preview event from a valid socket relays STROKE_PREVIEW_BROADCAST payload to all other sockets in the room; userId mismatch between payload and session causes the event to be dropped silently and emits a warning log entry containing socketId and received userId (FR-016, FR-017); missing or empty operationId causes silent drop; non-array points causes silent drop; stroke:cancel event from a valid socket relays STROKE_CANCEL_BROADCAST { operationId, userId } to room; socket disconnect emits USER_LEFT { userId } to the room
- [ ] T013 [P] [US2] Extend client/tests/unit/usePreviewLayer.test.js: socket event stroke:preview:broadcast calls setPreview() with the full received payload; socket event stroke:cancel:broadcast calls removePreview() with payload.operationId; socket event user:left removes all preview registry entries whose userId matches payload.userId and leaves entries from other users intact; **SC-003 transition test**: when a draw:broadcast event is received for an operationId that has an active preview, removePreview(operationId) is called before addOperation() — assert the previews map no longer contains the operationId at the moment the committed op is rendered (no ghost stroke); all four socket listeners (including draw:broadcast) are removed when the hook unmounts

### Implementation for User Story 2

- [ ] T014 [US2] Update server/src/handlers/eventHandlers.js: register handler for EVENTS.STROKE_PREVIEW — look up session via sessions.get(socket.id); if payload.userId !== session.userId drop and emit logger.warn({ socketId: socket.id, receivedUserId: payload.userId }); if operationId is missing, points is not a non-empty array, or type is not OP_TYPE.DRAW or ERASE drop silently; otherwise relay full payload via socket.to(session.roomId).emit(SERVER_EVENTS.STROKE_PREVIEW_BROADCAST, payload); register handler for EVENTS.STROKE_CANCEL — same userId validation and warn; if operationId missing drop silently; otherwise relay { operationId, userId: session.userId } via socket.to(session.roomId).emit(SERVER_EVENTS.STROKE_CANCEL_BROADCAST, ...); in the existing disconnect handler add socket.to(roomId).emit(SERVER_EVENTS.USER_LEFT, { userId }) before removing the session entry
- [ ] T015 [US2] Update client/src/hooks/usePreviewLayer.js: register socket listener for SERVER_EVENTS.STROKE_PREVIEW_BROADCAST that calls setPreview(payload); register socket listener for SERVER_EVENTS.STROKE_CANCEL_BROADCAST that calls removePreview(payload.operationId); register socket listener for SERVER_EVENTS.USER_LEFT that iterates the current previews map and calls removePreview() for every entry whose userId matches payload.userId; **FR-011**: register socket listener for SERVER_EVENTS.DRAW_BROADCAST (the existing draw:stroke broadcast event) that calls removePreview(payload.operationId) if an entry for that operationId exists in the previews map — this ensures the preview overlay is cleared before the committed stroke is painted on the main canvas, preventing ghost strokes on remote canvases; return a cleanup function from useEffect that removes all four listeners on unmount
- [ ] T016 [US2] Update client/src/components/Canvas.jsx: when a canvas:cleared operation is processed (the existing canvas clear path), call clearAllPreviews() from usePreviewLayer so all in-progress previews from all users are discarded on every canvas clear (FR-013)

**Checkpoint**: User Stories 1 and 2 are both functional. Multi-tab manual test passes. All unit and server integration tests pass.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Verify full integration across all layers, run all test suites, and add an E2E spec for the multi-user preview flow.

- [ ] T017 [P] Run the full client unit test suite and confirm no regressions: cd client && npm test
- [ ] T018 [P] Run the full server integration test suite and confirm no regressions: cd server && npm test
- [ ] T019 Update e2e/drawing.spec.js: add a live-preview scenario that opens the same room in two browser contexts, drags the pointer in context A, and asserts that an in-progress stroke appears on the canvas in context B before pointer-up

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 — BLOCKS all user story work
- **Phase 3 (US1)**: Depends on Phase 2; no dependency on US2
- **Phase 4 (US2)**: Depends on Phase 2 AND on T009 (usePreviewLayer.js must exist before T015 extends it)
- **Phase 5 (Polish)**: Depends on US1 and US2 completion

### User Story Dependencies

- **User Story 1 (P1)**: Depends only on Phase 1 + Phase 2 foundational work
- **User Story 2 (P2)**: Depends on Phase 1 + Phase 2 AND on T009 (usePreviewLayer.js created in US1 before T015 adds socket subscriptions)

### Within Each User Story

1. Tests (T003–T006 for US1; T012–T013 for US2) are written **first** and must FAIL before any implementation begins
2. Tool changes (T007, T008) before hook/component integration (T009, T010, T011)
3. Server handler (T014) can proceed in parallel with US1 after T012 is written
4. usePreviewLayer socket extensions (T015) depend on the base hook (T009) existing

### Parallel Opportunities

- T003, T004, T005, T006 — all US1 tests can be written in parallel (different files)
- T007, T008 — penTool and eraserTool can be updated in parallel (different files)
- T010 can start in parallel with T009 once T006 tests are in place
- T012, T013 — US2 tests can be written in parallel (different files)
- T014 (server) can run in parallel with T015 (client hook) after their respective tests are written
- T017, T018 — final test runs can execute in parallel

---

## Parallel Example: User Story 1 Tests (Write First)

```bash
# Write all four failing tests in parallel:
Task T003: Update client/tests/unit/penTool.test.js
Task T004: Update client/tests/unit/eraserTool.test.js
Task T005: Create client/tests/unit/usePreviewLayer.test.js
Task T006: Update client/tests/unit/useCanvasRenderer.test.js
```

## Parallel Example: User Story 1 Tool Implementation

```bash
# After T003 and T004 are written and failing:
Task T007: Update client/src/tools/penTool.js
Task T008: Update client/src/tools/eraserTool.js
```

## Parallel Example: User Story 2 Implementation

```bash
# After T012 and T013 are written and failing, and T009 exists:
Task T014: Update server/src/handlers/eventHandlers.js
Task T015: Update client/src/hooks/usePreviewLayer.js
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Add shared constants to shared/constants.js
2. Complete Phase 2: Add emit helpers to client/src/services/socket.js
3. Complete Phase 3: US1 — local stroke preview (tests → tools → hook → renderer → canvas)
4. **STOP and VALIDATE**: Open solo room, confirm stroke preview renders in real time
5. Deploy/demo solo experience if ready

### Incremental Delivery

1. Phase 1 + 2 → foundation ready
2. Phase 3 (US1) → local preview working → demo solo user experience (MVP)
3. Phase 4 (US2) → broadcasting working → demo multi-user live preview
4. Phase 5 → all tests green, E2E spec updated

### Parallel Team Strategy

After Phase 1 and 2 complete:

- **Developer A**: US1 tests (T003–T006) → implementations (T007–T011)
- **Developer B**: US2 server test (T012) → server handler implementation (T014)
  - *(T013 and T015 depend on T009 from Developer A — coordinate before starting T015)*

---

## Notes

- [P] tasks = different files with no inter-task dependencies at the time of execution
- TDD is **mandatory** per Constitution Principle I — mark tests failing before writing any implementation
- `usePreviewLayer.js` is touched in both US1 (created, T009) and US2 (socket subscriptions added, T015) — sequencing is required
- Preview events are NOT stored on the server; the server is a pure stateless relay
- The overlay `<canvas>` uses `pointer-events: none` so all pointer events fall through to the main canvas
- `crypto.randomUUID()` is available in all target browsers (Chrome/Firefox/Edge modern)
- Pointer capture set at pointer-down guarantees pointer-up delivery even when the pointer is outside the canvas bounds
- Each stroke:preview event carries the **full** accumulated points array (not a delta) so throttle rate-limiting loses no path data
