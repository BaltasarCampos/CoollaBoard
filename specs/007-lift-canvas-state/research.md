# Research: Lift Canvas State to RoomPage

**Feature**: 007-lift-canvas-state  
**Phase**: 0 — Pre-design research  
**Date**: 2026-05-22

## Decision 1: `useCanvas` socket subscriptions after the move

**Decision**: `useCanvas` retains its internal `DRAW_BROADCAST` and `CANVAS_CLEARED` socket subscriptions when it moves to `RoomPage`.

**Rationale**: The hook's convergence algorithm depends on CLEAR operations being stored in the operations list (`getVisibleOperations` finds the last CLEAR op and discards everything before it). Removing this behaviour would require a structural redesign of the convergence model. Keeping the subscriptions in `useCanvas` co-locates the data model with its update triggers, which is the established pattern in the codebase.

**Consequence for FR-008**: `useRoom` does **not** need a `clearOperations` callback. The spec's FR-008 was written with the intent of preventing duplicate socket listeners; since `useCanvas` now lives in `RoomPage` (not in a sibling scope), there is no duplication. `useRoom` is unchanged beyond receiving `addOperations` and `operations` as it does today.

**Alternatives considered**:
- Strip socket listeners from `useCanvas` and move all event handling to `useRoom` — rejected because it would split the convergence algorithm's data flow and complicate `useRoom` further.
- Keep `useCanvas` in Canvas with a `clearOperations` escape hatch — rejected because this feature's goal is precisely to move `useCanvas` to `RoomPage`.

---

## Decision 2: `useCanvas` `initialOperations` parameter

**Decision**: Add an optional `initialOperations` parameter to `useCanvas`, passed directly to `useState` as the initial value: `useState(initialOperations ?? [])`.

**Rationale**: `useState` accepts a lazy initialiser or a direct value. Using `initialOperations` as the initial value avoids an extra render cycle and eliminates the hydration `useEffect` that currently exists in `Canvas`. This is idiomatic React.

**Consequence**: `RoomPage` removes its own `useState(initialOperations)` and the `addOperations` callback entirely. These were duplicates of the state that `useCanvas` owns. The `useRoom` call in `RoomPage` continues to receive `addOperation` (singular, from `useCanvas`) for the reconnect delta-sync path.

**Alternatives considered**:
- Hydration `useEffect` in `RoomPage` — rejected (Q3 clarification answer A); adds an extra render and keeps the hydration logic split from the hook.

---

## Decision 3: `clearAllPreviews` on `CANVAS_CLEARED` — `onExternalClear` prop

**Decision**: `usePreviewLayer` stays in `Canvas`. `RoomPage` wires a `CANVAS_CLEARED` socket listener (inside `useRoom` or a dedicated `useEffect`) that calls an `onExternalClear` prop on `Canvas`. `Canvas` passes this directly to `clearAllPreviews`.

**Rationale**: `usePreviewLayer` is a local rendering concern — previews have no collaborative state significance. Moving it to `RoomPage` would thread six extra preview props down, increasing coupling with no benefit. The `onExternalClear` seam is the minimal interface.

**Consequence**: `Canvas` gains one new prop: `onExternalClear`. In a `useEffect`, `Canvas` calls `onExternalClear(() => clearAllPreviews())`. `RoomPage` passes the handler.

**Alternatives considered**:
- Move `usePreviewLayer` to `RoomPage` — rejected (Q1 clarification answer A).
- Keep `CANVAS_CLEARED` listener in `Canvas` as an exception — rejected because Canvas would then retain a socket dependency, undermining Story 2.

---

## Decision 4: `useRoom` reconnect path — `addOperations` vs `addOperation`

**Decision**: `useRoom` continues to receive an `addOperations` (plural) callback for the reconnect delta-sync path. `RoomPage` provides this by wrapping `useCanvas`'s `addOperation` in a loop: `(ops) => ops.forEach(addOperation)` or by exposing a dedicated `addOperations` from `useCanvas`.

**Rationale**: The reconnect path in `useRoom` calls `addOperationsRef.current(delta)` where `delta` is an array. The existing `setOperations` merge logic in `RoomPage` handled deduplication. After the move, `useCanvas`'s `addOperation` already deduplicates per-operation. A thin wrapper is sufficient.

**Alternatives considered**:
- Add `addOperations` (plural) to `useCanvas` — acceptable but adds API surface for a one-liner. The wrapper in `RoomPage` is simpler.

---

## Decision 5: Test updates needed

**Decision**: Tests for `useCanvas` and `useUndoRedo` require no assertion changes. Tests for `Canvas` and `RoomPage` require prop-surface changes in test setup only (per FR-009). The `useRoom.test.js` requires no changes since the hook's external contract is unchanged.

**Tests flagged for prop-surface update**:
- `useCanvas.test.js` — add test for `initialOperations` parameter (new behaviour)
- `Canvas.test.jsx` (if it exists) — update to pass required props
- `RoomPage.test.jsx` (if it exists) — verify `Toolbar` renders as sibling of `Canvas`

**Investigation**: The workspace has `useCanvas.test.js` and `useRoom.test.js` but no `Canvas.test.jsx` or `RoomPage.test.jsx` in the unit test directory. No rendering-level tests for these components currently exist, so no test setup changes are needed beyond `useCanvas.test.js`.
