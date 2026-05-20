# Research: Collaborative Undo / Redo

**Feature**: `006-undo-redo`
**Date**: 2026-05-20
**Status**: Complete — all unknowns resolved

---

## 1. Server-Side Undo/Redo History Storage Strategy

**Decision**: Extend each room object in `roomService.js` with three new fields:
- `userUndoStacks`: `Map<userId, HistoryEntry[]>` — per-user ordered list of reversible ops (DRAW, ERASE, and CLEAR triggered by that user), capped at `UNDO_HISTORY_DEPTH = 20`.
- `userRedoStacks`: `Map<userId, HistoryEntry[]>` — per-user list of undone ops eligible for redo (DRAW/ERASE only; CLEAR entries are never placed here per FR-005).
- `latestClearEntry`: `{ operationId: string, timestamp: number } | null` — a single room-level reference to the most recent unresolved CLEAR operation, available for undo by any participant.

**Rationale**: The spec is explicit that the server owns all history (FR-011). Adding these fields to the existing `room` object in `roomService.js` follows the established pattern (the room already owns `operations`, `connectedUsers`, etc.) without introducing new data stores or modules. The constant `UNDO_HISTORY_DEPTH = 20` is placed in `shared/constants.js` alongside the other room constants.

**Alternatives considered**:
- *Separate `historyService.js`*: Would fragment state that is logically part of the room and require room-ID cross-referencing. Rejected.
- *Client-side history*: Contradicts FR-011 and the spec clarification that the server is the authoritative owner. Rejected.

---

## 2. Operating on `room.operations` During Undo/Redo

**Decision**: Mutate `room.operations` in-place on undo and redo: filter out the undone `operationId` on undo; re-insert the full operation (sorted by `sequenceNumber`) on redo. The `seenOps` deduplication set is also updated — the operationId is removed from `seenOps` when an op is undone, and re-added when re-inserted on redo.

**Rationale**: Mutating `room.operations` ensures that any user joining the room mid-session (via `room:join`) receives the correct current-state operation list without needing special undo-aware logic in the join handler (FR-011). The existing `getVisibleOperations()` client algorithm (find last CLEAR, discard everything at or before) continues to work correctly after undo because the CLEAR operation itself is removed from `room.operations` when undone — pre-clear operations become visible automatically.

Removing from `seenOps` on undo is safe because undo is a server-driven action (not a client re-emit); the only way the same `operationId` re-enters `room.operations` is via `resolveRedo`, which is also server-driven — not a replayed client event.

**Alternatives considered**:
- *Mark operations as `undone: true` instead of removing*: Requires client to filter by `undone` flag everywhere (join hydration, rendering, redo). Adds noise to the join payload. Rejected.
- *Keep a separate `undoneOps` set keyed by operationId; filter client-side*: Clients would need to receive and maintain this set. Increases client complexity and violates FR-011's server-authority principle. Rejected.

---

## 3. `canUndo` / `canRedo` Client State Synchronisation

**Decision**: The server emits `SERVER_EVENTS.UNDO_STATE` (`undo:state`) directly to the relevant socket(s) after every event that changes undo/redo availability:

| Trigger | Recipients |
|---------|-----------|
| `draw:stroke` committed | Requesting socket (canUndo may have become true; canRedo becomes false) |
| `canvas:clear` committed | Requesting socket + all sockets in the room (all users may now have canUndo:true due to shared clear) |
| `undo:request` processed (stroke undo) | Requesting socket only |
| `undo:request` processed (clear undo) | All sockets in the room (latestClearEntry consumed; canUndo changes for everyone) |
| `redo:request` processed | Requesting socket only |
| `room:join` or `room:create` | The joining/creating socket |
| User disconnect | No emission needed (disconnecting user's state is gone; other users' state unchanged unless a pending clear existed — handled via clear undo event if needed) |

**Rationale**: The `canUndo` / `canRedo` values are per-user and depend on server state (FR-008). Sending them proactively from the server avoids the client having to mirror the server's history logic. Emitting to all room users after a clear undo is necessary because `latestClearEntry` is a shared resource — once consumed, every user's `canUndo` (if it was true only because of the clear) may change.

**Alternatives considered**:
- *Client computes canUndo/canRedo from incoming events*: Client would have to replicate server undo-stack logic. Duplicates code, risks divergence. Rejected.
- *Include canUndo/canRedo in every broadcast*: Wasteful for draw:stroke broadcasts received by all users; also different users have different values. Rejected.

---

## 4. Clear Undo — Shared Resource Semantics

**Decision**: Only the single most recent unresolved CLEAR is available room-wide (`room.latestClearEntry`). When any user successfully undoes the clear, `latestClearEntry` is set to `null` and the CLEAR operation is removed from `room.operations`. The triggering user's personal undo stack is also cleaned: if the CLEAR op appears there (because they triggered it), it is removed. No redo entry is placed anywhere for the clear (FR-005).

**Rationale**: The spec's assumption states "The clear-canvas undo rule applies only to the most recent unresolved clear-canvas event visible in the room's shared history." A single nullable reference is the simplest structure that satisfies this. Storing a queue of multiple undoable CLEARs was considered but contradicts the spec assumption.

**Ordering rule**: When a user presses undo, the server picks the "most recent" candidate between their personal undo stack top and `latestClearEntry` by comparing `timestamp` values. The candidate with the higher timestamp is undone first, giving true reverse-chronological ordering (FR-002).

**Edge: user who triggered the clear**:
- The CLEAR op appears both in their personal undo stack and in `latestClearEntry`.
- The server treats them as the same event (same `operationId` / timestamp).
- When the triggering user presses undo and the CLEAR is the most recent item, the `personal` branch is taken (it is at the top of their stack), and the server additionally sets `latestClearEntry = null`. This prevents double undo.

**Alternatives considered**:
- *Separate "shared clear undo" button*: FR-010 specifies a single Undo control. Rejected.
- *Store all unresolved CLEARs as a queue*: Contradicts spec assumption; over-engineers the common case. Rejected.

---

## 5. Redo-Stack Invalidation on New Drawing Action

**Decision**: Whenever a `draw:stroke` event (DRAW or ERASE) is committed for a user, the server calls `clearRedoStack(roomId, userId)` immediately after `pushToUndoStack`. This empties the redo stack before the new op's `undo:state` is emitted to the client. The client receives `canRedo: false` along with `canUndo: true`.

**Rationale**: FR-007 mandates that a new drawing action clears the redo stack. Doing it synchronously on the server during `draw:stroke` handling ensures there is no window where a `redo:request` could succeed after a new stroke has been committed.

**Alternatives considered**:
- *Clear on redo:request when new strokes exist*: Requires server to track "new strokes drawn since last undo" separately. More complex. Rejected.

---

## 6. Keyboard Shortcut Handling in React

**Decision**: `useUndoRedo` attaches a single `keydown` listener to `document` (not to the canvas element) so that shortcuts fire regardless of which element has focus within the app. `requestUndo` is called when `(e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey`. `requestRedo` is called when `(e.metaKey || e.ctrlKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))`. `e.preventDefault()` is called to suppress native browser undo in text inputs if any are focused.

**Rationale**: FR-010 requires shortcuts to work "while the canvas is in focus." Attaching to `document` is the standard React idiom for global shortcuts and gives the broadest coverage. The listener is registered in a `useEffect` and cleaned up on unmount.

**Alternatives considered**:
- *Attach to the canvas `<div>` with `tabIndex`*: Requires canvas wrapper to have keyboard focus. Unreliable when other UI elements are clicked. Rejected.
- *`useKeyDown` from a UI library*: Would introduce a new dependency, violating the no-new-packages constraint. Rejected.

---

## 7. Client-Side Timeout Guard (FR-014)

**Decision**: When `requestUndo()` or `requestRedo()` is called, `useUndoRedo` immediately sets a local `pending` flag and starts a 5-second `setTimeout`. If `undo:broadcast` / `redo:broadcast` does not arrive within 5 seconds, the timeout fires, clears the `pending` flag, and re-enables the undo/redo control. No error message is shown (spec clarification). The 5-second duration is a named constant `UNDO_CONFIRM_TIMEOUT_MS = 5000` in `shared/constants.js`.

**Rationale**: FR-014 and the spec clarification both specify a "reasonable timeout" with silent re-enable. 5 seconds is generous enough for high-latency connections and avoids permanently locking the UI.

**Alternatives considered**:
- *Disable button until server confirms, no timeout*: Would permanently lock the button on dropped connection. Rejected.
- *Optimistic rendering + rollback on timeout*: Contradicts FR-012. Rejected.

---

## 8. History Depth Enforcement

**Decision**: `pushToUndoStack(roomId, userId, entry)` enforces the cap inline: after pushing the new entry, if `stack.length > UNDO_HISTORY_DEPTH`, `stack.shift()` removes the oldest entry. The redo stack has no explicit cap — its size is bounded by `UNDO_HISTORY_DEPTH` because at most 20 ops can be on the undo stack before redo is possible, and new draw actions clear the redo stack (FR-007).

**Rationale**: The simplest enforcement: a single conditional after every push. The cap applies per-user. An exceeded cap is not surfaced to the user (spec FR-009 implies silent oldest-discard).

---

## 9. New Joiners Seeing Undone Operations

**Decision**: No special treatment needed. Because `resolveUndo` removes ops from `room.operations` (and `seenOps`), a user who joins after an undo naturally receives the already-pruned operation list via the existing `room:join` acknowledgement. The join handler also emits `undo:state` to the new socket so the Undo/Redo buttons initialise correctly.

**Rationale**: Inherits the existing convergence architecture — `room.operations` is always the correct view of the current canvas state. No undo-specific join logic is needed beyond the `undo:state` initialisation.

---

## 10. Run Agent Context Update Script

**Decision**: Run `.specify/scripts/bash/agent-context.sh` after Phase 1 artifacts are written to update the plan reference in `.github/copilot-instructions.md`.

**Rationale**: Required by the plan workflow to keep the agent context pointing to the active plan file.
