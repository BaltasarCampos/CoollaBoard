---

description: "Task list template for feature implementation"
---

# Tasks: Participants Panel

**Input**: Design documents from `/specs/008-participants-panel/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/socket-events.md ✅, quickstart.md ✅

**Tests**: Test tasks are included because the implementation plan (plan.md) explicitly declares Test-First as a passing constitutional principle and lists new unit test files as deliverables.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Exact file paths are included in all descriptions

---

## Phase 1: Setup

**Purpose**: Verify baseline stability before introducing new code.

- [ ] T001 Verify all existing tests pass by running `npm test` in `client/` and `server/`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared infrastructure — constants, server data model, and display-name propagation — that MUST be complete before any user story can be implemented.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [ ] T002 Add `PARTICIPANTS_UPDATED: 'participants:updated'` to `SERVER_EVENTS` in `shared/constants.js`
- [ ] T003 [P] Update `server/src/services/roomService.js`: add `userDisplayNames: new Map()` to room object in `createRoom()`; update `addUserToRoom(roomId, userId, displayName)` to store the name; update `removeUserFromRoom` to delete from `userDisplayNames`; add exported `getParticipants(roomId)` returning `Array<{ userId, displayName }>`
- [ ] T004 [P] Update `client/src/services/socket.js`: add `displayName` parameter to `createRoom(displayName)` and `joinRoom(roomId, displayName, lastSequence)`; include it in the emitted payloads; resolve with `participants` array from ack
- [ ] T005 [P] Update `client/src/hooks/useHomePage.js`: add `displayName` state, setter, and simple validation (non-empty after trim, max 30 chars); pass `displayName` to `createRoom` and `joinRoom` calls
- [ ] T006 Update `client/src/components/HomePage.jsx`: add a display-name text input field bound to `displayName` from `useHomePage.js`; disable create/join buttons when display name is empty (depends on T005)

**Checkpoint**: Shared constant exists, server can store/return participant names, client submits display names — user story implementation can now begin.

---

## Phase 3: User Story 1 — View All Participants (Priority: P1) 🎯 MVP

**Goal**: A user who joins a room immediately sees a participants panel listing all currently connected users, including themselves.

**Independent Test**: Have two users join the same room and verify both names appear in each user's participants panel without any page refresh.

### Tests for User Story 1

> **Write these tests FIRST; ensure they FAIL before writing implementation code.**

- [ ] T007 [P] [US1] Write unit tests for initial state of `useParticipants` hook in `client/tests/unit/useParticipants.test.js`: initialised with `initialParticipants` → `participants` equals that array and `isLoading` is `false`; initialised with empty array → `isLoading` is `false` and `participants` is `[]`
- [ ] T008 [P] [US1] Write unit tests for `ParticipantsPanel` in `client/tests/unit/ParticipantsPanel.test.jsx`: renders a list of participant names; shows "Loading…" when `isLoading` is `true`; renders correctly with an empty list

### Implementation for User Story 1

- [ ] T009 [US1] Update `server/src/handlers/eventHandlers.js`: import `getParticipants` from roomService; in `room:create` handler read `displayName` from payload (trim, default `'Unknown'`), store in session, pass to `addUserToRoom`, include `participants: getParticipants(roomId)` in ack; apply same changes to `room:join` handler; update sessions initialiser to `{ userId, roomId: null, displayName: null }` (depends on T003)
- [ ] T010 [US1] Create `client/src/hooks/useParticipants.js`: accept `initialParticipants` param; initialise `participants` to `initialParticipants` and `isLoading` to `false`; export `{ participants, isLoading }` (depends on T007, T002)
- [ ] T011 [P] [US1] Create `client/src/styles/components/participantspanel.css`: panel fixed-width (`220px`) right sidebar layout, fixed height derived from viewport minus header (e.g., `height: calc(100vh - var(--header-height))`), `overflow-y: auto`, `overflow: hidden; text-overflow: ellipsis; white-space: nowrap` on name items, basic list reset styles
- [ ] T012 [US1] Create `client/src/components/ParticipantsPanel.jsx`: accepts `participants`, `isLoading`, and `currentUserId` props; renders "Loading…" when `isLoading` is `true`; renders a `<ul>` of participant names otherwise; imports `participantspanel.css` (depends on T010, T011)
- [ ] T013 [US1] Update `client/src/hooks/useRoom.js`: extract `participants` array from `room:join` and `room:create` ack payloads; expose it from the hook return value (depends on T009)
- [ ] T014 [US1] Update `client/src/components/RoomPage.jsx`: import and render `<ParticipantsPanel>` as a sibling of `.room-page__canvas-area`; pass `participants` and `isLoading` from `useParticipants(initialParticipants)` bootstrapped with ack data from `useRoom`; pass `currentUserId` from `useRoom` (depends on T012, T013)

**Checkpoint**: User Story 1 is fully functional. A user joining a room sees all participant names immediately. Verify with two browser tabs.

---

## Phase 4: User Story 2 — Real-Time Participant Updates (Priority: P2)

**Goal**: The participants panel updates automatically — no page refresh — when any user joins or leaves the room.

**Independent Test**: Open two browser tabs in the same room. In a third tab join the room, then close it. Verify the panel in both existing tabs shows the join immediately and then removes the name on close.

### Tests for User Story 2

> **Write these tests FIRST; ensure they FAIL before writing implementation code.**

- [ ] T015 [P] [US2] Extend `client/tests/unit/useParticipants.test.js`: receiving a `participants:updated` socket event updates `participants` to the new list; unmounting the component unsubscribes the listener

### Implementation for User Story 2

- [ ] T016 [US2] Update `server/src/handlers/eventHandlers.js` `disconnect` handler: after `removeUserFromRoom`, emit `SERVER_EVENTS.PARTICIPANTS_UPDATED` with `{ participants: getParticipants(roomId) }` via `socket.to(roomId).emit` to remaining members (depends on T009)
- [ ] T017 [US2] Update `server/src/handlers/eventHandlers.js` `room:join` handler: after the ack is sent, broadcast `SERVER_EVENTS.PARTICIPANTS_UPDATED` with the full list to the entire room via `io.to(roomId).emit`; add the same broadcast to `room:create` (single-member state) (depends on T016)
- [ ] T018 [US2] Update `client/src/hooks/useParticipants.js`: subscribe to `SERVER_EVENTS.PARTICIPANTS_UPDATED`; on receipt set `participants` to `event.participants`; unsubscribe on unmount (depends on T015, T017)

**Checkpoint**: User Stories 1 and 2 are both functional. The panel reflects the live participant set at all times.

---

## Phase 5: User Story 3 — Visual Differentiation of Own Name (Priority: P3)

**Goal**: The current user's own name is rendered in bold with a "(You)" label, making it immediately distinguishable from all other participants.

**Independent Test**: One user in a room with others verifies their name shows "(You)" in bold while all other names are in the standard style.

### Tests for User Story 3

> **Write these tests FIRST; ensure they FAIL before writing implementation code.**

- [ ] T019 [P] [US3] Extend `client/tests/unit/ParticipantsPanel.test.jsx`: when `currentUserId` matches a participant's `userId`, that entry renders with "(You)" appended and a `data-self` or CSS class distinguishing it; other entries are unaffected

### Implementation for User Story 3

- [ ] T020 [P] [US3] Update `client/src/styles/components/participantspanel.css`: add `.participants-panel__item--self` rule applying `font-weight: bold` to self-highlight the current user's entry (depends on T011)
- [ ] T021 [US3] Update `client/src/components/ParticipantsPanel.jsx`: for each participant, if `participant.userId === currentUserId`, render `"{displayName} (You)"` and apply `participants-panel__item--self` CSS class; confirm `RoomPage.jsx` already passes `currentUserId` correctly (no change expected there) (depends on T019, T020)

**Checkpoint**: All three user stories are functional. Self-identification is visually clear at a glance.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Observability, edge-case hardening, and final validation.

- [ ] T023 [P] Add structured server-side log entries for participant join and leave in `server/src/handlers/eventHandlers.js`: log `{ timestamp, level: 'INFO', event: 'participant:join'|'participant:leave', roomId, userId, durationMs }` (and optionally `displayName`) using the existing logging pattern from `server/utils/logger.js` — must satisfy Principle VII
- [ ] T024 Run all quickstart.md validation scenarios: `npm test` in `client/` and `server/`; confirm the overflow/scroll, loading state, and reconnect edge cases pass; confirm no canvas operation regression

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 — **blocks all user stories**
- **User Stories (Phases 3–5)**: All depend on Phase 2 completion
  - Stories must be implemented sequentially (P1 → P2 → P3) because US2 extends `useParticipants.js` created in US1, and US3 extends `ParticipantsPanel.jsx` created in US1
- **Polish (Phase 6)**: Depends on all user story phases being complete

### User Story Dependencies

- **US1 (P1)**: Can start as soon as Phase 2 is complete — no dependency on US2 or US3
- **US2 (P2)**: Depends on US1 (`useParticipants.js` must exist); extends hook with event subscription
- **US3 (P3)**: Depends on US1 (`ParticipantsPanel.jsx` must exist); extends component with self-highlight rendering

### Within Each User Story

1. Tests (T007–T008, T015, T019) MUST be written and FAIL before implementation begins
2. Server changes before client hook changes
3. Hook before component (component imports hook)
4. Component before page integration
5. Story fully functional before next story begins

### Parallel Opportunities

- T003, T004, T005 (Phase 2) can run in parallel — different files
- T007, T008 (US1 tests) can run in parallel — different files
- T010, T011 (US1 implementation) can run in parallel — different files
- T015 (US2 test) can run in parallel with T016 (server disconnect handler)
- T019, T020 (US3 test + CSS) can run in parallel — different files
- T023 (observability) can run in parallel with T024 (validation)

---

## Parallel Execution Example: User Story 1

```bash
# After Phase 2 is complete, run these in parallel:
# Terminal 1 — write hook test (T007)
# Terminal 2 — write component test (T008)

# Wait for both to fail (confirming tests are correct), then:
# Terminal 1 — implement server handlers (T009)
# Terminal 2 — create participantspanel.css (T011)

# After T009: implement useParticipants.js (T010)
# After T010 + T011: implement ParticipantsPanel.jsx (T012)
# After T012: update useRoom.js (T013) and RoomPage.jsx (T014)
```

---

## Implementation Strategy

**MVP scope**: Complete Phase 1 + Phase 2 + Phase 3 (US1) only.  
This delivers the core value — visible participant names — with no real-time updates and no self-highlighting, which is a coherent and useful product state.

**Increment 2**: Add Phase 4 (US2) — real-time join/leave updates.  
**Increment 3**: Add Phase 5 (US3) — visual self-identification.  
**Final**: Phase 6 polish and full test validation.

**Format validation**: All 23 tasks follow the required checklist format — checkbox (`- [ ]`), sequential Task ID (`T001`–`T024`, T022 removed), optional `[P]` marker, optional `[USn]` label for user-story phases, description with exact file path.
