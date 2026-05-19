# Feature Specification: Live Stroke Preview

**Feature Branch**: `005-live-stroke-preview`  
**Created**: 2026-05-17  
**Status**: Draft  
**Input**: User description: "Implement a new feature so users can see a stroke reflected on their canvas as they are performing it and emits the necessary events so other users can see that drawing action too on their own canvases."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Local In-Progress Stroke Rendering (Priority: P1)

As a user drawing on the shared canvas, I see my stroke appear incrementally on the canvas while I am still holding and moving the pointer, before I lift it to commit the stroke.

**Why this priority**: This is the core drawing experience — without local feedback, the canvas feels unresponsive. It is the foundation all other stories build on and delivers direct, immediate value to the drawing user.

**Independent Test**: Open a room alone, pick the pen tool, press and drag the pointer across the canvas. The stroke line appears on the canvas in real time as you move, without waiting for pointer release.

**Acceptance Scenarios**:

1. **Given** the pen tool is selected and the user presses the pointer down on the canvas, **When** the user moves the pointer without releasing, **Then** a stroke segment is drawn on the canvas following the pointer position in real time.
2. **Given** an in-progress stroke is visible, **When** the user releases the pointer, **Then** the in-progress stroke is replaced by the committed stroke seamlessly (no flicker or disappearance).
3. **Given** an in-progress stroke is visible, **When** the pointer leaves the canvas bounds before release, **Then** point collection is paused and the current preview remains visible on the canvas; if the pointer re-enters the canvas, point collection resumes; the stroke is committed on pointer-up regardless of whether the pointer is inside or outside the canvas at the moment of release.
4. **Given** an in-progress stroke is visible, **When** a pointer-cancel event fires (e.g., the browser interrupts the gesture), **Then** the in-progress stroke is cancelled — the preview is removed and no commit is emitted.
5. **Given** the eraser tool is selected, **When** the user drags the pointer, **Then** the erased area is reflected in real time (same in-progress rendering behavior applies).

---

### User Story 2 - Broadcasting In-Progress Stroke to Remote Users (Priority: P2)

As a user in the same room watching another user draw, I see their stroke appear incrementally on my canvas as they move their pointer, mirroring their live drawing action.

**Why this priority**: This is the collaborative core of the product. Without it, remote users only see completed strokes in a "teleporting" fashion, which breaks the sense of shared presence.

**Independent Test**: Open the same room in two browser tabs. In tab A, press and drag with the pen tool. In tab B, the stroke segment should appear on the canvas progressively as tab A's pointer moves.

**Acceptance Scenarios**:

1. **Given** two users share a room and user A starts drawing, **When** user A moves the pointer, **Then** user B sees the in-progress stroke rendered on their canvas within a visually perceptible time.
2. **Given** user A's in-progress stroke is visible on user B's canvas, **When** user A releases the pointer and the stroke is committed, **Then** user B's canvas transitions from the preview to the committed stroke seamlessly.
3. **Given** user A is drawing, **When** user A's connection drops mid-stroke, **Then** user B's in-progress preview for user A is removed (or frozen) and does not become a permanent orphaned stroke.
4. **Given** multiple users are drawing concurrently, **When** each moves their pointer, **Then** each user sees all other in-progress strokes simultaneously without interference.

---

### Edge Cases

- What happens when the user draws a very fast stroke (few points captured before pointer up)? The commit event arrives immediately; the preview and commit must not cause a double-render.
- What happens when the network is slow and stroke preview events arrive out of order? The preview is always replaced by the most recent batch of points; stale out-of-order preview events are discarded.
- What happens if a pointer up event is lost (e.g., focus change)? The in-progress stroke on the originating client is cleared. If the socket remains connected, no cancel is emitted and the remote preview lingers until the next pointer-down cycle or the user reconnects. Server-side timeout cleanup is **out of scope** for this feature — it requires a dedicated heartbeat/TTL mechanism not designed here. The disconnect cleanup (Principle VIII) handles the socket-drop case only.
- What happens if a preview event arrives after the commit event for the same stroke? The commit takes precedence; the preview event is ignored for that operationId.
- What happens when the canvas is cleared while an in-progress stroke is being sent? The in-progress preview is removed from all canvases, and any subsequent commit for that stroke is discarded.
- What happens if the user releases the pointer while it is outside the canvas bounds? The pointer-up event is still delivered to the canvas because pointer capture is retained from pointer-down. The stroke is committed with all points accumulated before the pointer left the canvas; no points are added for travel outside the canvas bounds.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST render the drawing user's in-progress stroke on their own canvas starting from the first pointer-move event after pointer-down. The local in-progress stroke MUST render at full opacity, visually identical to a committed stroke.
- **FR-002**: The system MUST emit stroke-preview events to the server while the user is drawing (on pointer-move), containing the current accumulated points, color, and brush size.
- **FR-003**: The server MUST broadcast received stroke-preview events to all other connected users in the same room, without persisting the preview as a permanent operation and without caching the preview in-memory. The server is a stateless relay for preview events.
- **FR-004**: Remote clients MUST render in-progress stroke preview data received from the server on their canvas at full opacity, visually identical to committed strokes.
- **FR-005**: When a stroke is committed (pointer-up), the system MUST emit the existing `draw:stroke` commit event, and all canvases (local and remote) MUST replace the in-progress preview with the committed stroke. A pointer-up event MUST trigger a commit regardless of whether the pointer is inside or outside the canvas bounds at the moment of release.
- **FR-006**: In-progress preview strokes MUST NOT be persisted as permanent operations in the room's operation history on the server.
- **FR-007**: Each in-progress preview MUST be identified by the same `operationId` used for the eventual commit, so clients can correlate preview and commit events for the same stroke.
- **FR-008**: When a pointer-cancel event ends a stroke without a commit, the system MUST emit a stroke-cancel event, and all canvases MUST remove the in-progress preview for that operationId. When the pointer leaves the canvas bounds mid-stroke, the client MUST pause point collection and MUST NOT emit a commit or cancel event; the existing in-progress preview MUST remain visible on all canvases. If the pointer re-enters the canvas bounds, point collection MUST resume. The stroke is committed normally on the subsequent pointer-up event regardless of current pointer position.
- **FR-009**: Preview rendering MUST NOT interfere with the committed operations layer; previews are rendered as a separate visual layer above committed content.
- **FR-010**: The system MUST handle concurrent in-progress previews from multiple remote users simultaneously.
- **FR-011**: If a commit event for a given `operationId` arrives at a remote client while a preview for that ID is still visible, the client MUST remove the preview and render the committed stroke.
- **FR-012**: The eraser tool MUST also emit preview events during an in-progress erase operation so remote users see the erase area as it is being defined.
- **FR-013**: On canvas clear, the system MUST discard all in-progress previews on every client in the room.
- **FR-014**: The client MUST throttle outgoing stroke-preview events to at most one event per 30 ms (~33 updates/sec). Each emitted event carries the full accumulated points array up to that moment, so no intermediate points are permanently lost.
- **FR-015**: *(Reserved — intentionally skipped during spec authoring; requirement numbering continues at FR-016.)*
- **FR-016**: The server MUST validate that the `userId` field in any incoming stroke-preview or stroke-cancel event matches the authenticated socket session identity. Events with a mismatched `userId` MUST be dropped silently without being relayed.
- **FR-017**: When the server drops a stroke-preview or stroke-cancel event due to a `userId` mismatch (FR-016), it MUST emit a warning-level log entry including the `socketId` and the received `userId`.
### Key Entities

- **StrokePreview**: A transient, non-persisted representation of an in-progress drawing action. Attributes: `operationId` (UUID, generated by the client on pointer-down, correlates with future commit), `userId`, `type` (DRAW or ERASE), `points` (accumulated array of virtual coordinates), `color`, `brushSize`.
- **PreviewRegistry**: A per-client in-memory map from `operationId` to the latest `StrokePreview` received for that user. Keyed by `operationId`; replaced on each new preview event for the same stroke; deleted on commit or cancel.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A drawing user sees their stroke rendered on canvas within one pointer-move event of pressing down — no perceptible delay between pointer movement and visual stroke feedback.
- **SC-002**: Remote users see in-progress strokes appear within 200 ms of the drawing user's pointer movement under normal network conditions (< 50 ms round-trip latency).
- **SC-003**: A committed stroke appears visually identical whether it was preceded by a live preview or not — zero visible rendering artifacts at the preview-to-commit transition.
- **SC-004**: Canvases across all users in a room converge to identical committed state within 2 seconds of any stroke being completed, regardless of how many preview events were exchanged.
- **SC-005**: In-progress previews from disconnected users are removed from all canvases within 5 seconds of the disconnection event.
- **SC-006**: The system supports at least 5 concurrent in-progress strokes (from 5 different users) being rendered on a single canvas without visual degradation of committed content.

## Clarifications

### Session 2026-05-17

- Q: Should the server log a warning when a preview event is dropped due to a `userId` mismatch? → A: Yes — server logs a warning with `socketId` and received `userId` on every mismatch drop (FR-017).
- Q: Should the server validate that the `userId` in a preview event matches the sender's socket identity before relaying? → A: Yes — server validates `userId` against the socket session; mismatched events are dropped silently (FR-016).
- Q: Who generates the `operationId` and at what point in the drawing lifecycle? → A: Client on pointer-down — the drawing client generates a UUID at pointer-down, ensuring the same ID is used for all subsequent preview and commit events for that stroke.
- Q: Should a pointer-cancel acceptance scenario be added to User Story 1 to make FR-008's cancel path directly testable? → A: Yes — added as Acceptance Scenario 4: pointer-cancel cancels the preview and emits no commit.
- Q: At what opacity should a remote user's in-progress preview render on the local canvas? → A: Full opacity — previews render identically to committed strokes; no visual distinction between in-progress and committed strokes.
- Q: When the pointer leaves the canvas bounds mid-stroke (no pointer-up), should the stroke be committed or cancelled? → A: ~~Committed~~ **(superseded — see Session 2026-05-18)**
- Q: Is spec 004 (color & brush controls) already implemented, or does this feature have a dependency on it? → A: Already implemented — color and brush size state is available; no fallback to defaults is needed.
- Q: Should a maximum preview event throttle rate be defined as a behavioral requirement? → A: Yes — emit at most one preview event per 30 ms (~33 updates/sec).
- Q: Should the server maintain an in-memory registry of active previews to replay to newly joined or reconnecting users? → A: No — server relays preview events immediately and discards them; joining users will receive the next preview naturally within 30 ms.

### Session 2026-05-18

- Q: When the pointer leaves the canvas bounds mid-stroke, should the stroke pause, commit, or cancel? → A: Pause — point collection halts on pointer-leave and the current preview remains visible; collection resumes on pointer-enter; the stroke commits only on pointer-up wherever it occurs. Pointer capture is retained from pointer-down so pointer-up is always received even when the pointer is outside the canvas at release.

## Assumptions

- Users have a reasonably stable connection (< 200 ms round-trip latency); preview smoothness degrades gracefully but correctness is maintained on reconnect.
- The eraser tool follows the same pointer event model as the pen tool and benefits from the same preview mechanism.
- Spec 004 (color & brush controls) is already implemented. Color and brush size state is available at the time of pointer-down and remains constant for the duration of a stroke; no default-fallback behavior is needed for missing color/size values.
- The canvas virtual coordinate system is already established; preview points use the same coordinate space as committed points.
- Preview events are throttled to at most one emission per 30 ms on the client. Each event carries the complete accumulated points array to date, ensuring no path segments are lost despite the rate cap.
- Mobile / touch pointer events are out of scope for this feature; pointer events API is sufficient.
- Pointer event capture is retained from pointer-down for the duration of a stroke. This ensures pointer-up events are received even when the pointer is outside the canvas element at release, making pointer-up a reliable and unconditional commit trigger.
- The server is a stateless relay for preview events — it does not cache or replay them. A user joining mid-session will not see in-flight previews from others until the next preview event arrives (within 30 ms at most).
