# Feature Specification: Collaborative Undo / Redo

**Feature Branch**: `006-undo-redo`  
**Created**: 2026-05-20  
**Status**: Draft  
**Input**: User description: "implement a new feature that adds 'undo / redo' functionality to the app. Any user must be able to undo their own actions in reverse order and the result will be reflected on the rest of users' canvases too. Clear-canvas can be undone by any user independently of having performed the action in first place or not."

## Clarifications

### Session 2026-05-20

- Q: Where is the undo/redo history stored and processed? → A: Server-authoritative — server maintains all undo/redo stacks; clients emit undo/redo requests and receive instructions on what to apply.
- Q: When a clear-canvas is undone, what happens to strokes drawn after the clear? → A: Post-clear strokes are preserved; pre-clear content is restored and merged with any strokes drawn after the clear, so no new work is lost.
- Q: Can a clear-canvas event be redone after it has been undone? → A: No — once a clear is undone, the clear event is fully consumed and cannot be redone by anyone.
- Q: Should undo/redo use optimistic UI or wait for server confirmation? → A: Server-confirmed — the canvas updates only after the server broadcasts the confirmed change; no local speculative rendering.
- Q: What happens to a user's undo history when they disconnect and reconnect? → A: History is lost on disconnect — undo/redo stacks are cleared server-side when a user leaves the room.
- Q: Should the server enforce that users can only undo/redo their own strokes? → A: Yes — the server validates ownership for stroke undo/redo requests against the requesting user's socket identity; clear-canvas undo is the only exception and remains open to any participant.
- Q: What should the client do when a server error prevents undo/redo from completing? → A: Silent no-op — if no server confirmation arrives within a timeout, the undo/redo control is re-enabled and the canvas remains unchanged; no error message is shown.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Undo Own Stroke in Real Time (Priority: P1)

A user who has drawn one or more strokes on the shared canvas wants to undo their most recent stroke. After triggering undo, the stroke disappears from their own canvas and from every other connected participant's canvas immediately.

**Why this priority**: This is the foundational undo behaviour. Without it no other story is possible. It delivers immediate, visible value and represents the most common use case.

**Independent Test**: Can be fully tested by having a single user draw a stroke, trigger undo, and verify the stroke is removed both locally and on a second connected client.

**Acceptance Scenarios**:

1. **Given** a user has drawn at least one stroke, **When** the user triggers undo, **Then** the most recently drawn stroke by that user is removed from all participants' canvases within one second.
2. **Given** a user has drawn multiple strokes, **When** the user triggers undo repeatedly, **Then** strokes are removed one at a time in reverse order of creation, and each removal is reflected on all participants' canvases.
3. **Given** a user has no actions left to undo, **When** the user triggers undo, **Then** no change occurs and the undo control is visually disabled.
4. **Given** two users A and B have both drawn strokes, **When** user A triggers undo, **Then** only user A's last stroke is removed; user B's strokes remain intact on all canvases.

---

### User Story 2 - Clear-Canvas Undone by Any Participant (Priority: P2)

Any user in the room — including users who did not trigger the original clear-canvas action — can undo a clear-canvas event. When undone, all content that was present before the clear is restored on every participant's canvas.

**Why this priority**: Clear-canvas is the most destructive single action on the board. Allowing any participant to reverse it protects collaborative work and is an explicitly stated product requirement.

**Independent Test**: Can be fully tested by having user A clear the canvas, then having user B (who drew nothing) trigger undo for the clear event and verifying all prior content is restored on both clients.

**Acceptance Scenarios**:

1. **Given** user A clears the canvas, **When** user B (who performed no prior actions) triggers undo, **Then** the canvas is restored to the state it was in immediately before the clear on all participants' canvases.
2. **Given** the canvas was cleared, **When** any participant undoes the clear, **Then** only one undo is needed to fully restore all content that existed before the clear.
3. **Given** the canvas has never been cleared, **When** a user triggers undo, **Then** the clear-canvas undo option is not available (or has no effect), and personal stroke undo proceeds normally.
4. **Given** a clear has already been undone, **When** a user attempts to undo that same clear again, **Then** no duplicate restoration occurs.

---

### User Story 3 - Redo Last Undone Action (Priority: P3)

A user who has just undone one or more actions can redo them in forward order, restoring the undone content to all participants' canvases.

**Why this priority**: Redo is the natural complement to undo. Without it, users who over-undo would have to manually redraw content. It completes the undo/redo contract.

**Independent Test**: Can be fully tested by having a user draw, undo, then redo and verifying the stroke reappears on all connected clients.

**Acceptance Scenarios**:

1. **Given** a user has undone at least one action, **When** the user triggers redo, **Then** the most recently undone action is reapplied and visible on all participants' canvases within one second.
2. **Given** a user has undone multiple actions, **When** the user triggers redo repeatedly, **Then** actions are reapplied one at a time in the order they were originally performed.
3. **Given** a user has no undone actions available to redo, **When** the user triggers redo, **Then** no change occurs and the redo control is visually disabled.
4. **Given** a user has undone an action and then draws a new stroke, **When** the user attempts to redo, **Then** the redo stack for that user is cleared and redo is unavailable (new action invalidates the redo history).

---

### Edge Cases

- What happens when a user undoes a stroke that another user has partially erased? The undo still removes the original stroke; content erased by other users is unaffected.
- What happens to strokes drawn after a clear-canvas when the clear is undone? Pre-clear content is restored and merged with post-clear strokes; strokes drawn after the clear are preserved and not discarded.
- Can a clear-canvas be redone after being undone? No — the clear event is fully consumed on undo and does not appear on any participant's redo stack.
- What if a user disconnects mid-undo? The undo event may not propagate; remaining participants see the canvas in whatever state was last synced. On reconnection, the user's undo and redo stacks are empty.
- What if two users trigger undo simultaneously? Each undo is processed independently and in the order received by the server; both operations apply without conflict.
- What if a client sends a stroke undo request for a stroke that belongs to a different user? The server silently rejects the request; the canvas is unchanged and no error is surfaced to the requesting client.
- What if the server confirmation for an undo/redo never arrives (e.g., connection drop)? The client times out, re-enables the undo/redo control, and leaves the canvas unchanged; no error is shown and the user may retry.
- What happens if the undo history depth limit is reached? The oldest entry in the user's history is discarded silently and the undo control remains enabled for remaining entries.
- What if a user joins after a clear-canvas event that has not yet been undone? The clear-canvas undo entry is still available to that user if it falls within the retained history.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Each user MUST be able to undo their own most recent action (pen stroke, eraser stroke, or clear-canvas they triggered) using a dedicated undo control.
- **FR-002**: Each user MUST be able to undo any number of their own past actions in reverse chronological order, up to the system's history depth limit.
- **FR-003**: When a user performs an undo or redo, the resulting canvas state MUST be propagated to and rendered on all other connected participants' canvases in real time.
- **FR-004**: Clear-canvas events MUST be undoable by any participant in the room, regardless of which user originally triggered the clear.
- **FR-005**: Each clear-canvas event MUST be undoable only once; once undone, that clear event is fully consumed, removed from history, and MUST NOT be available for redo by any participant.
- **FR-006**: Each user MUST be able to redo their most recently undone action using a dedicated redo control.
- **FR-007**: Performing a new drawing action (pen or eraser) MUST clear the redo stack for that user, making previously undone actions no longer redoable.
- **FR-008**: The undo and redo controls MUST be visually disabled when no corresponding history is available for the current user.
- **FR-009**: The system MUST maintain a per-user undo history with a maximum depth of 20 actions per user.
- **FR-010**: Undo and redo operations MUST be triggerable via both a toolbar button and the standard keyboard shortcut (Ctrl+Z / Ctrl+Y or Cmd+Z / Cmd+Y).
- **FR-011**: The server MUST be the authoritative owner of all undo/redo history; clients MUST emit undo/redo request events to the server and apply only the canvas changes the server instructs them to render.
- **FR-012**: Undo and redo operations MUST NOT alter the local canvas until the server has confirmed and broadcast the resulting change; no optimistic local rendering is performed.
- **FR-013**: The server MUST validate that a stroke undo/redo request originates from the user who owns that stroke history entry; requests targeting another user's strokes MUST be silently rejected. Clear-canvas undo requests are exempt from this restriction.
- **FR-014**: If the client does not receive a server confirmation for an undo/redo request within a reasonable timeout, the client MUST re-enable the undo/redo control and leave the canvas unchanged; no error message is displayed to the user.

### Key Entities

- **UserActionHistory**: A per-user ordered list of reversible actions, bounded by the history depth limit. Each entry contains enough information to both remove and restore the action on the canvas.
- **ClearCanvasEvent**: A shared room-level event representing a canvas clear. Available for undo by any participant; consumed (removed from history) once undone by any participant.
- **UndoStack**: The ordered collection of past actions available for a user to undo (most-recent-first).
- **RedoStack**: The ordered collection of undone actions available for a user to redo (most-recently-undone-first). Cleared when the user performs a new drawing action.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can undo their last action and see the change reflected across all connected clients within 1 second under normal network conditions.
- **SC-002**: Any user can undo a clear-canvas event within the same session in which it occurred without needing to have performed any prior drawing actions.
- **SC-003**: Undo and redo controls are visually disabled when no history is available, achieving a 0% rate of no-op undo/redo actions triggered by button interaction.
- **SC-004**: No collaborative data from other users is lost or altered when one user performs undo or redo.
- **SC-005**: Keyboard shortcuts for undo and redo are functional 100% of the time while the browser tab is active and no text input element is focused (implemented via a `document`-level `keydown` listener, which fires regardless of which canvas element holds focus).
- **SC-006**: The undo history correctly resets the redo stack upon a new drawing action, verified by automated tests covering the full undo → draw → redo-unavailable flow.

## Assumptions

- Users have a stable enough connection that real-time undo propagation is feasible; offline undo-only (local) is out of scope.
- The history depth limit of 20 actions per user is sufficient for typical collaborative sessions; configurable limits are out of scope for this feature.
- Undo/redo applies to pen strokes, eraser strokes, and clear-canvas events. Other future actions (e.g., inserting images or text) may be addressed in later features.
- The clear-canvas undo rule (any user can undo it) applies only to the most recent unresolved clear-canvas event visible in the room's shared history; partial or selective restoration of individual strokes from before the clear is not required. When the clear is undone, pre-clear content is merged with any strokes drawn after the clear — no post-clear work is discarded.
- The server is the single authoritative source of undo/redo history; clients do not maintain independent history stacks and cannot perform undo/redo without a server round-trip.
- Undo/redo uses a server-confirmed rendering model; no optimistic local application is performed. Brief latency between triggering undo/redo and seeing the result is acceptable.
- Session history is not persisted across browser refreshes or reconnections; the server clears a user's undo/redo stacks when they disconnect from a room.
- Mobile / touch support for undo/redo shortcuts is out of scope; toolbar buttons are the primary mobile interaction.
