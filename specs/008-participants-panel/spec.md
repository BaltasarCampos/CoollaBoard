# Feature Specification: Participants Panel

**Feature Branch**: `008-participants-panel`  
**Created**: 2026-05-26  
**Status**: Draft  
**Input**: User description: "implement a new feature consisting of a participants panel. It is a panel visible in room page and containing the names of all users in the room. It will update accordingly when users join or leave the room. I will visually differentiate the name of the main user over the rest of participants."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View All Participants (Priority: P1)

A user joins a room and sees a participants panel listing the names of everyone currently in the room, including themselves.

**Why this priority**: Knowing who is in the room is fundamental to collaboration. Without a participant list, users have no awareness of who they are working with, making this the core value of the feature.

**Independent Test**: Can be fully tested by having two users join the same room and verifying both names appear in the panel for each user, delivering immediate social context awareness.

**Acceptance Scenarios**:

1. **Given** a user has joined a room with other participants, **When** the Room page loads, **Then** the participants panel is visible and displays the names of all currently connected users
2. **Given** a user is the only person in a room, **When** the Room page loads, **Then** the participants panel shows only that user's name
3. **Given** multiple users are in a room, **When** a new user views the panel, **Then** all participant names are listed, including the new user's own name

---

### User Story 2 - Real-Time Participant Updates (Priority: P2)

A user already in a room sees the participants panel update automatically when someone joins or leaves, without refreshing the page.

**Why this priority**: Static participant lists quickly become inaccurate. Real-time updates ensure users always have correct awareness of who is present, which is essential for a collaborative tool.

**Independent Test**: Can be fully tested by observing the panel in an open browser tab while a second user joins and then leaves the room, confirming the panel reflects each change promptly.

**Acceptance Scenarios**:

1. **Given** a user is viewing the room, **When** a new participant joins the room, **Then** the new participant's name appears in the panel without requiring a page reload
2. **Given** a user is viewing the room, **When** a participant leaves or disconnects from the room, **Then** that participant's name is removed from the panel without requiring a page reload
3. **Given** a user is viewing the room, **When** multiple participants join or leave in quick succession, **Then** the panel accurately reflects the final state of connected participants

---

### User Story 3 - Visual Differentiation of Own Name (Priority: P3)

The current user's own name is displayed in the participants panel in a visually distinct way that makes it immediately recognizable compared to other participants' names.

**Why this priority**: Visual self-identification reduces cognitive load. Users instantly know their own name is correct and can orient themselves within the group without scanning carefully.

**Independent Test**: Can be fully tested by a single user joining a room with others and confirming their name is visually distinguishable at a glance from the rest of the list.

**Acceptance Scenarios**:

1. **Given** a user is in a room with other participants, **When** they look at the participants panel, **Then** their own name is displayed in bold with a "(You)" label appended (e.g., "Alice (You)"), while all other names appear in the standard style
2. **Given** a user is in a room alone, **When** they look at the participants panel, **Then** their own name still appears bold with the "(You)" label
3. **Given** a new participant joins a room, **When** that participant looks at the panel, **Then** only their own name receives the bold + "(You)" treatment; all other names appear in the standard style

---

### Edge Cases

- What happens when the room has a very large number of participants and the list exceeds the panel's visible area?
- How does the panel behave if a participant's connection drops momentarily and then reconnects?
- What is displayed if a user's name is very long or contains special characters?
- **Loading state**: While the initial participant list is being received from the server, the panel displays a loading indicator (spinner, skeleton, or "Loading…" text). No names are shown until the list is available.
- **Overflow/scroll**: When the participant list exceeds the panel's visible height, the list scrolls internally. The panel maintains a fixed height and does not expand to fit all names.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST display a participants panel on the Room page that is visible at all times while the user is in the room, positioned as a fixed sidebar on the right side of the layout
- **FR-002**: The panel MUST list the display names of all users currently connected to the room
- **FR-003**: The panel MUST add a participant's name automatically when that user joins the room
- **FR-004**: The panel MUST remove a participant's name automatically when that user leaves or disconnects from the room
- **FR-005**: The panel MUST visually differentiate the current user's own name from the names of other participants by rendering it in bold with a "(You)" label appended (e.g., "Alice (You)")
- **FR-006**: The panel MUST reflect the accurate list of participants at all times without requiring manual refresh
- **FR-007**: When the participant list exceeds the panel's visible height, the list MUST scroll internally; the panel MUST maintain a fixed height and MUST NOT expand to accommodate all names

### Key Entities

- **Participant**: A connected user in a room, identified by their display name
- **Room**: The collaborative space that contains a dynamic set of participants
- **Current User**: The local user viewing the panel; their entry is visually distinct from all other participants

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All participants in a room are visible in the panel within 1 second of the panel first rendering
- **SC-002**: The participant list reflects a join or leave event within 1 second of the event occurring
- **SC-003**: The current user's name is visually distinguishable from other participants without requiring any additional action or guidance
- **SC-004**: The participant list is 100% accurate with respect to currently connected users at any given moment during normal use

## Assumptions

- User display names are already set before entering a room (handled by existing room join flow)
- The server already broadcasts room membership events (join/leave) to all connected clients in the room
- The panel is always visible on the Room page; it is not hidden behind a toggle or menu in the initial implementation
- The panel is read-only; participants cannot interact with other users' names (e.g., no kick, mute, or profile actions in scope)
- Mobile responsiveness is a secondary concern; the panel must function correctly on desktop viewports
- A participant who briefly disconnects and reconnects is treated as a leave followed by a join
- Duplicate display names are allowed; the panel displays all connected users as-is without deduplication or disambiguation (name uniqueness enforcement is out of scope for this feature)

## Clarifications

### Session 2026-05-26

- Q: How should the participants panel handle duplicate display names? → A: Allow duplicates — display all names as-is; every connected user is shown regardless of name repetition
- Q: What should the panel display while loading before the participant list arrives from the server? → A: Show a loading indicator (spinner, skeleton, or "Loading…" text) until the list is received
- Q: Where on the Room page should the participants panel be positioned? → A: Fixed sidebar on the right side of the room layout
- Q: What visual treatment should distinguish the current user's own name? → A: Bold text with a "(You)" label appended (e.g., "Alice (You)")
- Q: What should happen when the participant list is too long to fit in the panel? → A: Scroll internally — panel has fixed height, list scrolls
