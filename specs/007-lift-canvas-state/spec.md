# Feature Specification: Lift Canvas State to RoomPage

**Feature Branch**: `007-lift-canvas-state`  
**Created**: 2026-05-22  
**Status**: Draft  
**Input**: User description: "Lift canvas state to RoomPage. Consolidate the duplicate operations state by moving useCanvas from Canvas to RoomPage, making Canvas a pure rendering/input component. As a consequence, useUndoRedo and Toolbar also move to RoomPage, which becomes the single owner of all collaborative room state"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Consistent Collaborative Drawing State (Priority: P1)

A user joins a room and draws, erases, undoes, and redoes strokes. All state changes — the visible strokes, undo/redo availability, and the toolbar controls — reflect a single unified source of truth rather than two independent copies of the operation list that can drift apart.

**Why this priority**: The duplicate operations state is the root cause of any synchronisation bugs between what RoomPage tracks (for server-sync) and what Canvas renders. Consolidating to a single state eliminates the class of bugs entirely and is the prerequisite for all other collaborative features.

**Independent Test**: Open a room, draw three strokes, receive a remote stroke via socket broadcast, undo twice, and verify the canvas renders exactly the expected strokes, the undo/redo buttons reflect the correct enabled state, and the server-synced operation list matches the rendered list.

**Acceptance Scenarios**:

1. **Given** a user is in a room with no strokes, **When** they draw a stroke, **Then** the stroke appears on the canvas and is tracked in a single operations list owned by RoomPage.
2. **Given** a user has drawn three strokes, **When** they click Undo, **Then** the most recent stroke is removed from the canvas and the undo/redo buttons update accordingly — all driven by RoomPage's single state.
3. **Given** a remote peer draws a stroke, **When** the broadcast arrives, **Then** the new operation is added once (not twice) to the shared list and the canvas re-renders correctly.
4. **Given** the canvas is cleared by any user, **When** the clear event is received, **Then** the operations list in RoomPage is emptied and the canvas and toolbar both reflect the cleared state.

---

### User Story 2 - Pure Rendering Canvas Component (Priority: P2)

A developer working on the codebase can reason about `Canvas` purely as an input-capture and rendering surface. It receives all state via props and emits raw user-input events upward, containing no hooks that own state or communicate directly with the server for state management.

**Why this priority**: Simplifying `Canvas` to a pure rendering/input component reduces cognitive overhead, makes it straightforward to test in isolation (no socket mocking needed), and opens the door to using it in non-room contexts (e.g., a solo whiteboard or an embedded preview).

**Independent Test**: Render `Canvas` in a unit test by providing only props (operations list, tool settings, event callbacks). Verify it renders expected strokes without requiring any socket or room context to be provided.

**Acceptance Scenarios**:

1. **Given** a `Canvas` component instantiated with a static operations list via props, **When** it mounts, **Then** it renders those strokes without connecting to any socket or room service.
2. **Given** a user draws a stroke on the canvas, **When** the pointer-up event fires, **Then** the canvas calls a provided callback with the completed operation object rather than adding it to internal state.
3. **Given** undo/redo request callbacks and availability flags are passed as props, **When** the user clicks Undo or Redo in the toolbar, **Then** the corresponding prop callback is invoked and the toolbar enabled state reflects the passed-in flags.

---

### User Story 3 - RoomPage as Single Collaborative State Owner (Priority: P3)

`RoomPage` is the authoritative component for all collaborative session state: the operations list, undo/redo state, tool settings, and the `Toolbar` layout. Any component that needs to read or change collaborative state does so through `RoomPage` via props.

**Why this priority**: Centralising ownership makes the data flow explicit and unidirectional, aligning the codebase with established React patterns and making future features (presence indicators, per-user operation attribution, conflict resolution) easier to implement in one place.

**Independent Test**: Inspect the rendered component tree for a room session and confirm that `Toolbar` is a direct child of `RoomPage` (not of `Canvas`), and that `Canvas` receives all operation data and callbacks as props without importing any room-state hooks.

**Acceptance Scenarios**:

1. **Given** a room page is rendered, **When** the component tree is inspected, **Then** `Toolbar` appears as a sibling of `Canvas` inside `RoomPage`, not as a descendant of `Canvas`.
2. **Given** `RoomPage` owns all collaborative state, **When** a new feature needs to read the current operations list, **Then** it can obtain it from `RoomPage` without reaching into `Canvas` internals.
3. **Given** `useCanvas` and `useUndoRedo` have been moved to `RoomPage`, **When** `Canvas.jsx` is inspected, **Then** it imports neither `useCanvas` nor `useUndoRedo`.

---

### Edge Cases

- What happens when `initialOperations` contains duplicate operation IDs on hydration? The deduplication logic must remain intact after the move.
- How does the system handle a `CANVAS_CLEARED` socket event when the clear listener is now wired in `RoomPage`? Preview cleanup must still clear all in-flight stroke previews.
- How does pointer-cancel mid-stroke behave when the callback chain crosses the boundary from `Canvas` up to `RoomPage`? The partial stroke must not be committed to the operations list.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: `RoomPage` MUST own and manage the single canonical operations list, replacing the split ownership between `RoomPage`'s `useState` and `Canvas`'s `useCanvas`.
- **FR-002**: `RoomPage` MUST invoke `useCanvas` directly to obtain `addOperation`, `removeOperation`, and `getVisibleOperations`, passing the results to `Canvas` and to `useUndoRedo` as props/arguments.
- **FR-003**: `RoomPage` MUST invoke `useUndoRedo`, receiving `canUndo`, `canRedo`, `requestUndo`, and `requestRedo`, and pass them to `Toolbar` as props.
- **FR-004**: `RoomPage` MUST render `Toolbar` directly as a sibling of `Canvas`, removing `Toolbar` from `Canvas`'s render output.
- **FR-005**: `Canvas` MUST accept `addOperation`, `removeOperation`, `getVisibleOperations`, `canUndo`, `canRedo`, `requestUndo`, `requestRedo`, and an `onExternalClear` callback as props instead of deriving them from internal hooks. The raw `operations` array is NOT passed as a prop — `Canvas` calls `getVisibleOperations()` directly when rendering. `Canvas` calls the `addOperation` prop directly on pointer-up with the fully assembled operation object.
- **FR-006**: `Canvas` MUST NOT import or call `useCanvas`, `useUndoRedo`, or render `Toolbar`.
- **FR-007**: The socket listener for `CANVAS_CLEARED` that clears previews MUST continue to function. `RoomPage` adds a dedicated `CANVAS_CLEARED` `useEffect` (separate from `useCanvas`'s internal subscription) that calls the `onExternalClear` prop on `Canvas`. `Canvas` wires `onExternalClear` to `clearAllPreviews` from `usePreviewLayer`.
- **FR-008**: `useRoom` interface is unchanged. `useCanvas` (now in `RoomPage`) retains its own `CANVAS_CLEARED` subscription to add the CLEAR operation to the list, which is required for the convergence algorithm. `RoomPage` passes `addOperations: (ops) => ops.forEach(addOperation)` and `operations` to `useRoom` as before, supporting the reconnect delta-sync path.
- **FR-009**: All existing unit and integration tests MUST pass without modification to their assertions; only test setup may change to reflect the new prop surface.
- **FR-010**: The user-visible behaviour of the collaborative whiteboard — drawing, erasing, undo, redo, clear, remote broadcast — MUST be unchanged.
- **FR-011**: `useCanvas` MUST accept an optional `initialOperations` array parameter used as the `useState` initial value, eliminating the need for a separate hydration `useEffect` in `RoomPage`.

### Key Entities

- **Operations list**: The ordered collection of drawing operations representing the current canvas state. After this change, owned exclusively by `RoomPage` via `useCanvas`.
- **Canvas component**: The pointer-event capture surface and rendering host. After this change, stateless — all state arrives as props and all events are emitted via callbacks.
- **RoomPage component**: The collaborative session container. After this change, the single owner of operations, undo/redo state, tool settings, and the Toolbar.
- **useCanvas hook**: Encapsulates the operations list, deduplication logic, and the `addOperation`/`removeOperation`/`getVisibleOperations` API. Retains internal socket subscriptions for `DRAW_BROADCAST` and `CANVAS_CLEARED` (needed for convergence). Moves from `Canvas` to `RoomPage`. Accepts an optional `initialOperations` parameter.
- **useUndoRedo hook**: Manages undo/redo availability flags and emits requests to the server. Moves from `Canvas` to `RoomPage`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The operations list exists in exactly one place in the component tree — confirmed by removing the duplicate `useState(initialOperations)` from `RoomPage` and the `useCanvas()` call from `Canvas`.
- **SC-002**: All 14 existing client unit test files pass without changes to test assertions after the refactor.
- **SC-003**: All server and integration tests continue to pass, confirming no change to the collaborative protocol.
- **SC-004**: `Canvas.jsx` imports are reduced — it no longer imports `useCanvas`, `useUndoRedo`, or `Toolbar`.
- **SC-005**: A user can complete a full collaborative session (join room → draw → receive remote strokes → undo → redo → clear) with behaviour identical to before the refactor.

## Assumptions

- `usePreviewLayer` stays inside `Canvas`. Previews are purely a local rendering concern and do not cross the Canvas boundary. The `CANVAS_CLEARED` socket listener in `RoomPage` calls an `onExternalClear` prop on `Canvas`, which `Canvas` wires to `clearAllPreviews`. `Canvas` does not listen to the `CANVAS_CLEARED` event directly.
- `useCanvasRenderer` stays inside `Canvas` as a rendering-only concern.
- Tool objects (`penTool`, `eraserTool`) stay as module-level singletons inside `Canvas`; they carry ephemeral pointer state and are not part of the collaborative state model.
- Mobile and touch-event behaviour is unchanged by this refactor.
- No changes are made to the server-side code or the shared constants.
- `.canvas-wrapper` remains in `Canvas`, wrapping only the two `<canvas>` elements. `Toolbar` and the `Canvas` component become siblings inside `RoomPage`'s existing `.room-page__canvas-area` container. No CSS class renames are required.

## Clarifications

### Session 2026-05-22

- Q: Where does `usePreviewLayer` live after the refactor, and how is the `CANVAS_CLEARED` event handled? → A: Keep `usePreviewLayer` in `Canvas`; add `onExternalClear` prop for the cleared event
- Q: Where should the operations-list reset on clear be triggered? → A: `useCanvas` retains its own `CANVAS_CLEARED` subscription; `useRoom` is unchanged. A separate `RoomPage` `useEffect` calls `onExternalClear` on Canvas for preview cleanup only.
- Q: How should `useCanvas` be initialised with existing operations in `RoomPage`? → A: `useCanvas` accepts `initialOperations` parameter (used as `useState` initial value)
- Q: Where does `.canvas-wrapper` live after `Toolbar` is lifted out of `Canvas`? → A: `.canvas-wrapper` stays in `Canvas`, wraps only the two `<canvas>` elements; toolbar is a sibling in `.room-page__canvas-area`
- Q: How does `Canvas` deliver a completed operation to `RoomPage`'s state? → A: `Canvas` calls `addOperation` prop directly on pointer-up
