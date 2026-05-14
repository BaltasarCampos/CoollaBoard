# Feature Specification: CoollaBoard Collaborative Canvas MVP

**Feature Branch**: `001-coollaboard-mvp`  
**Created**: 2026-05-14  
**Status**: Draft  
**Input**: User description: "build the barely minimum MVP for a collaborative canvas app called CoollaBoard. The app consists of a shared room where multiple users can simultaneously draw in a canvas in real time. For this mvp you will only implement the freehand drawing tool, erase tool and clear canvas tool. Users can join an existing room or create a new one. Room state is stored in server memory only (no database); data loss on server restart is acceptable for the MVP. Users do not require persistent accounts or authentication in the MVP."

## User Scenarios & Testing *(mandatory)*

<!--
  User stories are PRIORITIZED as user journeys ordered by importance.
  Each story is INDEPENDENTLY TESTABLE and delivers standalone value.
-->

### User Story 1 - Room Creation and Joining (Priority: P1)

A user visits the app and can either create a brand-new drawing room or join an existing one by entering a room ID. The server generates a unique room ID for new rooms that the user can share with others. Another user enters the ID to join the same shared canvas.

**Why this priority**: Room management is the foundational capability — without it, no collaboration is possible. All other features depend on users being able to share a canvas session.

**Independent Test**: Open the app, create a room, copy the room ID, open a second browser tab, enter the room ID to join. Verify both tabs are connected to the same canvas (both display the same empty canvas and any subsequent drawing in one tab is visible in the other). This validates the core session-sharing flow with no drawing required.

**Acceptance Scenarios**:

1. **Given** a user visits the app homepage, **When** they choose to create a new room, **Then** they are taken to a canvas page for a newly created room with a unique, shareable room ID visible to them.
2. **Given** a user has a valid room ID, **When** they enter the room ID and confirm, **Then** they are taken to the canvas for that room and see its current drawn state.
3. **Given** a user enters a malformed room ID (not exactly 6 uppercase alphanumeric characters), **When** they attempt to join, **Then** the client validates the format before any server request, shows an inline format error, and does not leave the join page. Lowercase input is silently normalised to uppercase; clearly invalid input (wrong length or disallowed characters after normalisation) triggers the inline error immediately.
4. **Given** a user enters a correctly formatted but non-existent room ID, **When** they attempt to join, **Then** the server returns a not-found error and they see a clear error message and remain on the join page.

---

### User Story 2 - Real-Time Freehand Drawing (Priority: P1)

Multiple users in the same room can draw freehand strokes on the canvas. Each user's strokes are broadcast to all other participants in real time so the shared canvas appears to update simultaneously across all connected clients.

**Why this priority**: Drawing is the core value proposition of CoollaBoard. Without real-time stroke sharing, the app delivers no collaborative value.

**Independent Test**: Two browser tabs joined to the same room. Draw a stroke in tab 1 and verify it appears in tab 2 within 1 second, then draw in tab 2 and verify it appears in tab 1. Validates the full real-time synchronization loop in both directions.

**Acceptance Scenarios**:

1. **Given** two users are in the same room, **When** one user draws a freehand stroke, **Then** the stroke appears on both users' canvases within 1 second.
2. **Given** two users are drawing simultaneously, **When** both draw at the same time, **Then** both strokes appear on both canvases without either being lost or corrupted.
3. **Given** a new user joins a room that already has drawings, **When** they enter the room, **Then** they see all previously drawn strokes rendered on the canvas before they can interact.

---

### User Story 3 - Erase Tool (Priority: P2)

A user can switch to the erase tool and erase portions of the canvas by drawing over them with the eraser. The erasure is broadcast to all other participants in the room in real time.

**Why this priority**: Erasing is a fundamental drawing capability that allows users to correct mistakes and collaborate more effectively. It builds on the drawing infrastructure and is a natural complement to freehand drawing.

**Independent Test**: One user draws a stroke, switches to the erase tool, and erases a portion of the stroke. Verify: (1) the erased area is cleared on the erasing user's canvas; (2) the erasure is visible to a second user in the same room in real time.

**Acceptance Scenarios**:

1. **Given** a user has selected the erase tool, **When** they drag the cursor over drawn content, **Then** the content under the eraser path is cleared from the canvas.
2. **Given** a user erases a portion of the canvas, **When** other users in the same room observe the canvas, **Then** they see the same erasure reflected in real time.
3. **Given** a user switches between the draw tool and the erase tool, **When** they use each tool, **Then** the correct drawing or erasing behavior is applied without side effects.

---

### User Story 4 - Clear Canvas (Priority: P2)

Any user in a room can trigger a "clear canvas" action that removes all drawings from the shared canvas for all participants simultaneously. A confirmation step prevents accidental clearing.

**Why this priority**: Clearing allows all users to start fresh without leaving the room, which is essential for demos, brainstorming rounds, and collaborative iteration.

**Independent Test**: Two users in the same room both have drawings on the canvas. One user clicks the clear canvas button, confirms the action, and verifies that the canvas is blank for both users immediately after.

**Acceptance Scenarios**:

1. **Given** a canvas has drawings from one or more users, **When** a room participant triggers the clear canvas action and confirms, **Then** all drawings are removed from the canvas for all participants in the room simultaneously.
2. **Given** a user clicks clear canvas, **When** the confirmation prompt appears, **Then** the canvas is only cleared after the user explicitly confirms; cancelling the prompt leaves the canvas unchanged.
3. **Given** a clear canvas action is broadcast, **When** another user is actively drawing, **Then** the clear takes effect and the canvas is blank; any stroke in progress at the time of clearing is discarded.

---

### Edge Cases

- What happens when a user tries to join a non-existent room? → An error message is displayed; no room is implicitly created.
- What happens when a user loses network connectivity while drawing? → The in-progress stroke is lost; upon reconnecting the user receives the latest canvas state from the server.
- What happens when a user draws in a room with no other active participants? → Strokes are still saved to the room's in-memory state; future joiners will see them.
- What happens when the server restarts? → All room state is lost; users must create a new room. This is acceptable for the MVP.
- What happens when two users trigger clear canvas at nearly the same time? → Both actions execute; the result is an empty canvas for all participants (idempotent outcome).
- What happens when a user tries to draw on an empty erase pass (no prior content)? → The erase operates normally with no visible effect; no error occurs.
- What happens when a user reconnects after the room's grace period has expired? → The room no longer exists; the client redirects the user to the home/join page with an explanatory "room no longer exists" message.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST allow a user to create a new drawing room and receive a unique, shareable room ID.
- **FR-002**: The system MUST allow a user to join an existing room by entering a valid room ID.
- **FR-003**: The client MUST validate room ID format (exactly 6 characters, A–Z and 0–9) before sending any request to the server; malformed input MUST show an inline format error immediately. Lowercase input MUST be silently normalised to uppercase. A correctly formatted but non-existent room ID MUST result in a clear server-returned error message on the join page.
- **FR-004**: The system MUST display the full current canvas state to a user upon joining an existing room (state hydration).
- **FR-005**: The system MUST allow a user to draw freehand strokes on the canvas using a pen tool.
- **FR-006**: The system MUST broadcast each user's freehand strokes to all other participants in the same room in real time.
- **FR-007**: The system MUST allow a user to select an erase tool and erase drawn content from the canvas by drawing over it.
- **FR-008**: The system MUST broadcast erase actions to all participants in the same room in real time.
- **FR-009**: The system MUST provide a clear canvas action that removes all drawings from the shared canvas.
- **FR-010**: The clear canvas action MUST be reflected simultaneously for all participants in the same room.
- **FR-011**: The clear canvas action MUST require a user confirmation step before executing.
- **FR-012**: The system MUST store room state (all drawing and erase operations) in server memory only; no external database or file persistence is required.
- **FR-013**: Users MUST NOT be required to create an account or authenticate in any way to use the app.
- **FR-014**: The system MUST support multiple users drawing simultaneously in the same room without operations being lost.
- **FR-015**: The server MUST retain a room in memory for a grace period of 30–60 seconds after the last participant disconnects before permanently deleting it; a user who reconnects within the grace period MUST rejoin the same room and see its existing canvas state.
- **FR-016**: The canvas page MUST display a persistent, always-visible connection status indicator in a fixed corner of the UI. The indicator MUST reflect one of three states — Connected, Reconnecting, or Disconnected — and update in real time as the socket connection state changes.
- **FR-017**: If a user attempts to reconnect to a room after the grace period has expired and the room no longer exists, the client MUST redirect the user to the home/join page and display a clear "room no longer exists" message.

### Key Entities

- **Room**: A shared drawing session identified by a unique ID. Holds the ordered log of all drawing and erase operations that constitute the current canvas state. Exists only in server memory.
- **Drawing Operation**: A single user action (draw stroke or erase stroke) recorded as an ordered sequence of coordinates in the fixed 1920×1080 virtual coordinate space, the tool type used, and a unique identifier for deduplication. Replayed to reconstruct the canvas for new joiners.
- **User Session**: An anonymous, temporary participant identity assigned automatically when a user connects. Has no persistent storage and is discarded on disconnect.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can create a new room and be presented with a shareable room ID within 3 seconds of initiating the action.
- **SC-002**: A user can successfully join an existing room and see its canvas state within 3 seconds of submitting a valid room ID.
- **SC-003**: Freehand drawing strokes drawn by one user appear on all other participants' canvases within 1 second under normal network conditions.
- **SC-004**: Erase and clear canvas actions are reflected on all participants' canvases within 1 second of being triggered.
- **SC-005**: At least 5 simultaneous users can draw in the same room without any strokes being lost or the canvas state diverging between participants.
- **SC-006**: The app is fully usable without any account creation, login, or identity verification step.
- **SC-007**: A new user joining a room with up to 500 existing drawing operations sees the full canvas state rendered within 3 seconds.
- **SC-008**: The connection status indicator updates to reflect the correct state (Connected / Reconnecting / Disconnected) within 1 second of a socket connection change.

## Assumptions

- All users draw in the same default stroke color (black) at a fixed brush width of 4 virtual canvas units for the MVP; per-user color selection and variable brush sizes are deferred to future iterations.
- The erase tool operates by clearing the painted area the cursor passes over (area-based erasure), not by removing entire strokes. The eraser has a fixed radius of 20 virtual canvas units for the MVP; this is a shared constant and is not a per-operation field.
- Canvas state is represented on the server as an ordered log of drawing operations that is replayed client-side to reconstruct the canvas for new joiners.
- Room IDs are 6-character alphanumeric codes (uppercase A–Z and digits 0–9, ~2.2 billion combinations) to make manual sharing easy while minimising collision and brute-force risk.
- A room is deleted from server memory after a short grace period (30–60 seconds) following the last user's disconnect. This prevents accidental room loss on browser refresh while keeping memory clean.
- Desktop browser usage is the only supported environment for the MVP; mobile and touch interfaces are out of scope.
- Undo/redo functionality is out of scope for the MVP.
- Real-time cursor visibility (showing other users' live cursor positions) is out of scope for the MVP.
- Room state is lost on server restart; this data loss is explicitly acceptable for the MVP.
- There is no limit enforced on the number of users per room for the MVP.
- There is no cap on the number of drawing operations a room can accumulate for the MVP; unbounded log growth is accepted and any size limit is deferred to a future iteration.
- The technology stack is React (frontend with Canvas API + Socket.IO client), Node.js (backend with Socket.IO server), structured as a monorepo with `client/`, `server/`, and `shared/` directories, as mandated by the project constitution (`.specify/memory/constitution.md`).
- The canvas uses a fixed virtual coordinate space of 1920×1080 units. All drawing operation coordinates are recorded in this virtual space. Each client scales and letterboxes the canvas to fit its viewport; rendering translates virtual coordinates to screen pixels at render time.

## Clarifications

### Session 2026-05-14

- Q: What technology stack will CoollaBoard use? → A: React + Canvas API + Socket.IO client (frontend); Node.js + Socket.IO server (backend); monorepo with client/, server/, shared/ — as defined in .specify/memory/constitution.md.
- Q: How should the canvas coordinate system work across clients with different browser/window sizes? → A: Fixed virtual canvas (1920×1080); clients scale-to-fit; all coordinates stored in virtual space.
- Q: What is the eraser's size in virtual canvas units? → A: Fixed radius of 20 virtual units (shared constant, not stored per-operation).
- Q: What is the exact format for room IDs? → A: 6 alphanumeric characters (A–Z, 0–9).
- Q: What should happen to the join UI validation when a user enters a room ID with the wrong format? → A: Client validates format first (6 chars, A–Z/0–9); shows inline error before any server request; silently uppercases lowercase input.
- Q: When the last user leaves a room, when is the room deleted from server memory? → A: Short grace period (30–60 seconds after last disconnect); room survives a browser refresh.
- Q: What connection status feedback should the UI show to users, and where? → A: Persistent status indicator in a fixed corner; always-visible badge showing Connected, Reconnecting, or Disconnected.
- Q: What is the maximum number of drawing operations a room can accumulate before a size cap applies? → A: No cap for MVP; unbounded growth accepted; deferred to future iteration.
- Q: What are the concrete default stroke color and brush width for the MVP? → A: Black stroke, brush width 4 virtual canvas units (shared constants, not stored per-operation).
- Q: What should happen when a user reconnects after the room's grace period has expired? → A: Redirect to home/join page with a clear "room no longer exists" message.
