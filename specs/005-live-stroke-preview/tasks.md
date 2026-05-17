---

description: "Task list for Live Stroke Preview feature implementation"
---

# Tasks: Live Stroke Preview

**Input**: Design documents from `/specs/005-live-stroke-preview/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/socket-events.md ✅

**Tests**: Included — TDD approach specified in plan.md constitution check. Write tests first (Red), then implement (Green).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Exact file paths are included in every description

## Path Conventions

Monorepo layout: `client/`, `server/`, `shared/`, `e2e/` at repository root.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Add event name constants that all other tasks depend on. Must complete first.

- [ ] T001 Add `EVENTS.DRAW_STROKE_PREVIEW`, `EVENTS.DRAW_STROKE_CANCEL`, `SERVER_EVENTS.PREVIEW_BROADCAST`, and `SERVER_EVENTS.PREVIEW_CANCEL` constants to `shared/constants.js`; also add `PREVIEW_OPACITY = 0.6` (within the 50–70% range specified in FR-005) so all consumers reference a single named value

**Checkpoint**: Constants available — all subsequent files can import them.

---

## Phase 2: Foundational (Socket Service Emitters)

**Purpose**: Add the two outbound socket helpers that tool modules call. Must be complete before Phase 3 implementation.

**⚠️ CRITICAL**: Tool modules (penTool.js, eraserTool.js) cannot emit preview events until these emitters exist.

- [ ] T002 [P] Write unit tests for `emitStrokePreview()` (emits `draw:stroke-preview` with correct payload) and `emitStrokeCancel()` (emits `draw:stroke-cancel` with correct payload) in `client/tests/unit/socket.test.js`
- [ ] T003 Implement `emitStrokePreview(operationId, type, points, color, brushSize)` and `emitStrokeCancel(operationId)` in `client/src/services/socket.js` (depends on T002 tests failing first, T001 for constants)

**Checkpoint**: Socket service emitters verified and implemented — tool modules can now import them.

---

## Phase 3: User Story 1 — Local In-Progress Stroke Rendering (Priority: P1) 🎯 MVP

**Goal**: The drawing user sees their own stroke appear incrementally on the canvas from the first pointer-move event, before releasing the pointer. The stroke is cancelled (not committed) when the pointer leaves the canvas or is interrupted.

**Independent Test**: Open a room alone, select the pen tool, press and drag the pointer across the canvas — the stroke line appears in real time without waiting for pointer release. Drag the pointer off the canvas edge — the in-progress stroke disappears and no commit is sent.

### Tests for User Story 1 ⚠️ Write FIRST — ensure they FAIL before implementation

- [ ] T004 [P] [US1] Add tests to `client/tests/unit/penTool.test.js`: (a) `operationId` is a UUID generated at `onPointerDown` and reused on subsequent moves; (b) first `onPointerMove` call emits `draw:stroke-preview` immediately with full accumulated points; (c) second `onPointerMove` within 30 ms does NOT emit again; (d) `onPointerMove` after 30 ms DOES emit; (e) cancel method calls `emitStrokeCancel` with the active `operationId`
- [ ] T005 [P] [US1] Add the same throttle, `operationId`, and cancel-method tests for the eraser tool to `client/tests/unit/eraserTool.test.js` (mirrors T004 for `eraserTool.js`)
- [ ] T006 [P] [US1] Add local-preview rendering tests to `client/tests/unit/useCanvasRenderer.test.js`: (a) when a local `points` array is provided, a rendering pass is executed above committed ops; (b) local preview renders at `ctx.globalAlpha === 1.0` (full opacity); (c) when `points` is empty or null, no extra render pass occurs

### Implementation for User Story 1

- [ ] T007 [P] [US1] Modify `client/src/tools/penTool.js`: generate UUID `operationId` in `onPointerDown` (not `onPointerUp`); add `lastPreviewEmit = 0` timestamp; in `onPointerMove` call `emitStrokePreview` when `Date.now() - lastPreviewEmit >= 30`; add `onPointerCancel()` method that calls `emitStrokeCancel(operationId)` and resets drawing state (depends on T004 tests, T003 emitters)
- [ ] T008 [P] [US1] Modify `client/src/tools/eraserTool.js` with the same `operationId`, `lastPreviewEmit` timestamp, throttled preview emission in `onPointerMove`, and `onPointerCancel()` method as T007 (depends on T005 tests, T003 emitters)
- [ ] T009a [P] [US1] Write React Testing Library tests for `client/src/components/Canvas.jsx` in `client/tests/unit/Canvas.test.jsx`: (a) `onPointerLeave` event calls the active tool's `onPointerCancel()` and resets local drawing state; (b) `onPointerCancel` event calls the same cancel path; (c) `setPointerCapture` is NOT called on `onPointerDown` after this change *(Constitution §I — test must be written and failing before the Canvas.jsx implementation below)*
- [ ] T009 [US1] Modify `client/src/components/Canvas.jsx`: remove `canvas.setPointerCapture(e.pointerId)` call; add `onPointerLeave` handler that invokes the active tool's cancel method and clears local drawing state; add `onPointerCancel` handler with identical cancel logic (depends on T009a tests failing first, T007, T008)
- [ ] T010 [US1] Add local in-progress stroke rendering pass to `client/src/hooks/useCanvasRenderer.js`: accept the active tool's current `points`, `color`, and `brushSize` as props/params; render the points path at `ctx.globalAlpha = 1.0` after committing ops but before restoring context; restore `globalAlpha` after the pass (depends on T006 tests, T009)

**Checkpoint**: User Story 1 is fully functional — single user sees their stroke rendered in real time and the cancel path removes the preview on pointer-leave.

---

## Phase 4: User Story 2 — Broadcasting In-Progress Stroke to Remote Users (Priority: P2)

**Goal**: The server relays each in-progress stroke preview event to all other room participants. Remote clients receive, store, and render in-progress previews. Disconnected users' orphaned previews are cleaned up automatically.

**Independent Test**: Open the same room in two browser tabs. In tab A, press and drag with the pen tool — tab B should show the stroke appearing progressively. Drop tab A's connection mid-stroke — tab B's preview disappears within 5 seconds.

### Tests for User Story 2 ⚠️ Write FIRST — ensure they FAIL before implementation

- [ ] T011 [P] [US2] Add server integration tests for `draw:stroke-preview` relay to `server/tests/integration/drawHandlers.test.js`: (a) valid payload broadcasts `draw:preview-broadcast` with `userId` injected to all other sockets in the room; (b) `session.activePreviewId` is set to `operationId`; (c) `addOperation()` is NOT called; (d) invalid payload (missing `operationId`, empty `points`, bad `type`) does not broadcast
- [ ] T012 [P] [US2] Add server integration tests for cancel and cleanup to `server/tests/integration/drawHandlers.test.js`: (a) `draw:stroke-cancel` broadcasts `draw:preview-cancel` to room and clears `session.activePreviewId`; (b) `draw:stroke` commit clears `session.activePreviewId = null`; (c) socket `disconnect` with non-null `activePreviewId` emits `draw:preview-cancel` to room; (d) socket `disconnect` with null `activePreviewId` does NOT emit `draw:preview-cancel`
- [ ] T013 [P] [US2] Add `PreviewRegistry` state management tests to `client/tests/unit/useCanvas.test.js`: (a) `draw:preview-broadcast` event upserts `StrokePreview` into `previews` Map keyed by `operationId`; (b) `draw:preview-cancel` event deletes the entry from `previews`; (c) `draw:broadcast` (commit) event removes matching `operationId` from `previews` before rendering committed op; (d) `canvas:cleared` event calls `previews.clear()`
- [ ] T014 [P] [US2] Add remote preview rendering tests to `client/tests/unit/useCanvasRenderer.test.js`: (a) when `previews` Map has entries, a rendering pass is executed for each entry; (b) each entry is rendered as a path using its `points`, `color`, and `brushSize`; (c) remote preview pass executes above committed ops layer

### Implementation for User Story 2

- [ ] T015 [US2] Extend `eventHandlers.js` session shape with `activePreviewId: null`; register `draw:stroke-preview` handler: validate payload, set `session.activePreviewId = operationId`, relay enriched payload (with `userId`) to room via `draw:preview-broadcast` (excluding sender), log `{ event, roomId, userId, operationId }` in `server/src/handlers/eventHandlers.js` (depends on T011 tests)
- [ ] T016 [US2] Add remaining handlers to `server/src/handlers/eventHandlers.js`: (a) `draw:stroke-cancel` — validate `operationId`, clear `session.activePreviewId = null`, emit `draw:preview-cancel` to room (excluding sender), log event; (b) modify existing `draw:stroke` handler to clear `session.activePreviewId = null`; (c) modify `disconnect` handler to emit `draw:preview-cancel` to room if `session.activePreviewId` is non-null (depends on T012 tests, T015)
- [ ] T017 [US2] Modify `client/src/hooks/useCanvas.js`: initialise `previews` as a `Map` ref; register `SERVER_EVENTS.PREVIEW_BROADCAST` listener that upserts into `previews` and marks canvas dirty; register `SERVER_EVENTS.PREVIEW_CANCEL` listener that deletes from `previews` and marks dirty; modify `draw:broadcast` handler to delete matching `operationId` from `previews` before rendering; modify `canvas:cleared` handler to call `previews.clear()` (depends on T013 tests, T001 constants)
- [ ] T018 [US2] Add remote preview rendering pass to `client/src/hooks/useCanvasRenderer.js`: iterate `previews` Map, draw each `StrokePreview`'s path using `points`, `color`, and `brushSize`; render this pass above the committed ops layer (depends on T014 tests, T017)
- [ ] T019 [P] [US2] Add two-user live stroke preview E2E scenario to `e2e/drawing.spec.js`: (a) tab A presses and drags — tab B's canvas shows an in-progress stroke before tab A lifts the pointer; (b) tab A releases — tab B transitions to the committed stroke with no visual gap; (c) tab A drags and disconnects — use `expect.poll()` with a **5 000 ms** timeout to assert tab B's in-progress preview is absent within 5 s (SC-005 timing SLA) (depends on T016, T018)

**Checkpoint**: User Story 2 is fully functional — remote users see live in-progress strokes; the server is a stateless relay; disconnect cleanup works correctly.

---

## Phase 5: User Story 3 — Distinguishable Remote Preview Visual Style (Priority: P3)

**Goal**: Remote in-progress previews render at reduced opacity (60%) so viewers can distinguish live-preview marks from fully committed strokes at a glance.

**Independent Test**: In a two-user room, have user A drag slowly; on user B's canvas the in-progress stroke should appear at noticeably reduced opacity compared to committed strokes. When user A lifts the pointer, the stroke's opacity immediately matches other committed strokes.

### Tests for User Story 3 ⚠️ Write FIRST — ensure they FAIL before implementation

- [ ] T020 [P] [US3] Add opacity-value tests to `client/tests/unit/useCanvasRenderer.test.js`: (a) `ctx.globalAlpha` is set to `0.6` before the remote preview rendering pass; (b) `ctx.globalAlpha` is restored to `1.0` after the preview pass; (c) local in-progress pass (from US1/T010) still uses `globalAlpha = 1.0`
- [ ] T021 [P] [US3] Add E2E opacity scenario to `e2e/drawing.spec.js`: in a two-user room, capture a screenshot while user A is mid-stroke and verify that the preview pixels on user B's canvas are visually lighter than a committed stroke of the same color (pixel-level or screenshot comparison) (depends on T019 E2E infrastructure)

### Implementation for User Story 3

- [ ] T022 [US3] Update remote preview rendering pass in `client/src/hooks/useCanvasRenderer.js`: import `PREVIEW_OPACITY` from `shared/constants.js`; set `ctx.globalAlpha = PREVIEW_OPACITY` immediately before iterating the `previews` Map and rendering each entry; restore `ctx.globalAlpha = 1.0` immediately after the pass completes (depends on T020 tests, T018, T001 constant)

**Checkpoint**: User Story 3 is complete — remote previews are visually distinguishable at 60% opacity; committed strokes remain at full opacity; transition on commit is seamless.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Validate edge cases, verify non-regression of existing behaviour, confirm cross-cutting correctness, and assert measurable success criteria.

- [ ] T023 [P] Add E2E edge case to `e2e/drawing.spec.js`: canvas clear mid-stroke — while user A is drawing (preview visible on user B), trigger a clear; verify user B's canvas becomes blank with no orphaned preview strokes
- [ ] T024 [P] Add E2E edge case to `e2e/drawing.spec.js`: fast stroke (pointer-down immediately followed by pointer-up before the 30 ms throttle fires) — verify the committed stroke appears correctly on both canvases and no phantom preview lingers
- [ ] T025 Add automated assertion to `server/tests/integration/drawHandlers.test.js`: after a sequence of `draw:stroke-preview` + `draw:stroke` events, assert that `room.operations` length equals only the number of committed `draw:stroke` calls (zero preview-only entries); use the existing room state accessor from `roomService.js` — no manual inspection required
- [ ] T026 [P] Add SC-002 latency assertion to the E2E two-user scenario in `e2e/drawing.spec.js`: record `Date.now()` immediately before tab A emits the first `draw:stroke-preview`; use a Playwright `page.waitForFunction` on tab B's canvas dirty state; assert the elapsed time is ≤ 200 ms (SC-002: remote preview visible within 200 ms under local loopback)
- [ ] T027 [P] Add SC-004 convergence assertion to the E2E two-user scenario in `e2e/drawing.spec.js`: after tab A commits its stroke, poll tab B's canvas pixel hash (or a committed-ops count exposed via a `data-testid`) until it matches tab A's; assert convergence within 2 000 ms using `expect.poll()` (SC-004)
- [ ] T028 [P] Add SC-006 concurrent-stroke stress scenario to `e2e/drawing.spec.js`: open 5 browser tabs in the same room; start a simultaneous pointer-drag on each; assert that every tab renders at least 4 remote-preview paths without any committed-op corruption (pixel diff or op-count assertion); assert the committed canvas state is identical across all 5 tabs after all strokes are released (SC-006)

---

## Dependencies

```
T001 → T002, T003 (constants needed by socket service)
T002 → T003 (tests before implementation, TDD)
T003 → T007, T008 (emitters needed by tools)
T004 → T007 (test before implementation, TDD)
T005 → T008 (test before implementation, TDD)
T006 → T010 (test before implementation, TDD)
T007 → T009 (pen tool cancel method needed by Canvas.jsx)
T008 → T009 (eraser tool cancel method needed by Canvas.jsx)
T009 → T010 (Canvas.jsx handlers trigger local preview rendering)
T011 → T015 (tests before implementation, TDD)
T012 → T016 (tests before implementation, TDD)
T013 → T017 (tests before implementation, TDD)
T014 → T018 (tests before implementation, TDD)
T015 → T016 (session shape must exist before cancel/disconnect handlers)
T009a → T009 (Canvas.jsx test must fail before Canvas.jsx impl, TDD)
T016 → T019 (server cancel path needed for E2E disconnect scenario)
T017 → T018 (previews Map needed for rendering pass)
T018 → T019 (rendering needed for E2E visual verification)
T019 → T026, T027 (E2E two-user infrastructure needed for latency/convergence assertions)
T019 → T028 (E2E infrastructure needed for concurrent-stroke scenario)
T020 → T022 (opacity test before implementation, TDD)
T019 → T021 (E2E infrastructure needed for opacity scenario)
T018 → T022 (rendering pass exists; T022 only sets globalAlpha value)
T001 → T022 (PREVIEW_OPACITY constant must exist before renderer imports it)
```

---

## Parallel Execution Opportunities

### Fully parallel after T001 (constants):

```
T002 (socket tests) ──────────────────────► T003 (socket impl)
T004 (penTool tests) ─────────────────────► T007 (penTool impl)
T005 (eraserTool tests) ──────────────────► T008 (eraserTool impl)
T006 (renderer local tests) ──────────────► T010 (renderer local impl)
```

### Fully parallel after T003 (emitters done):

```
T007 + T008 can execute in parallel (different files)
```

### Fully parallel after US1 complete (T007–T010):

```
T011 (server relay tests)       ─► T015 (server relay impl)
T012 (server cancel tests)      ─► T016 (server cancel impl)
T013 (useCanvas registry tests) ─► T017 (useCanvas impl)
T014 (renderer remote tests)    ─► T018 (renderer remote pass)
```

### US3 parallel:

```
T020 (opacity tests) ─► T022 (opacity impl)
T021 (E2E opacity)  (can run after T019 infrastructure)
```

### Phase 6 parallel (after T019 E2E two-user scenario):

```
T026 (SC-002 latency)      ─┐
T027 (SC-004 convergence)  ─┤  all parallel, all depend on T019
T028 (SC-006 concurrent)   ─┘
```

---

## Implementation Strategy

**MVP** (deliver User Story 1 only — T001–T010):
- Single-user drawing experience is complete and correct.
- No socket changes needed beyond constants and service emitters.
- Can be shipped and verified in isolation before building broadcast.

**Increment 2** (add User Story 2 — T011–T019):
- Full collaborative real-time preview with server relay and disconnect cleanup.
- E2E two-user scenario passes.

**Increment 3** (add User Story 3 — T020–T022):
- Visual distinction for remote previews is added with a single `globalAlpha` change.
- No architectural change required — purely additive to the rendering pass.

**Polish** (T023–T025):
- Edge case E2E coverage and non-regression validation of operation history integrity.
