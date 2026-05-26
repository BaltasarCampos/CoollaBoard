# Quickstart: Participants Panel

**Feature**: `008-participants-panel`

This guide explains the key implementation steps for a developer picking up this feature.

---

## Prerequisites

- Node.js 20+
- All existing tests passing: `npm test` from `client/` and `server/`
- Feature branch `008-participants-panel` checked out

---

## Implementation Order (dependency-safe)

Work in this order to keep tests green at each step:

### 1. Shared constants

**File**: `shared/constants.js`

Add to `SERVER_EVENTS`:
```js
PARTICIPANTS_UPDATED: 'participants:updated',
```

### 2. Server — roomService

**File**: `server/src/services/roomService.js`

- Add `userDisplayNames: new Map()` to the room object in `createRoom()`.
- Update `addUserToRoom(roomId, userId, displayName)` to also do `room.userDisplayNames.set(userId, displayName ?? 'Unknown')`.
- Update `removeUserFromRoom(roomId, userId)` to also do `room.userDisplayNames.delete(userId)`.
- Add `getParticipants(roomId)` that returns `Array<{ userId, displayName }>` by iterating `connectedUsers` and looking up each name.

```js
export function getParticipants(roomId) {
  const room = getRoom(roomId);
  if (!room) return [];
  return [...room.connectedUsers].map((uid) => ({
    userId: uid,
    displayName: room.userDisplayNames.get(uid) ?? 'Unknown',
  }));
}
```

### 3. Server — eventHandlers

**File**: `server/src/handlers/eventHandlers.js`

- Add `getParticipants` to the import from `roomService`.
- In `room:create` handler:
  - Read `displayName` from payload (trim, default to `'Unknown'`).
  - Store in `sessions.get(socket.id).displayName = displayName`.
  - Pass to `addUserToRoom(room.roomId, session.userId, displayName)`.
  - Include `participants: getParticipants(room.roomId)` in the ack response.
  - After ack, emit `SERVER_EVENTS.PARTICIPANTS_UPDATED` to the room.
- In `room:join` handler:
  - Same pattern; also emit `PARTICIPANTS_UPDATED` to the **entire room** (`io.to(roomId).emit`).
- In `disconnect` handler: after `removeUserFromRoom`, emit `PARTICIPANTS_UPDATED` to remaining room members.
- Update `sessions` entry initializer: `{ userId, roomId: null, displayName: null }`.

### 4. Client — socket service

**File**: `client/src/services/socket.js`

Update `createRoom` and `joinRoom` to accept and forward `displayName`:

```js
export function createRoom(displayName) {
  return new Promise((resolve, reject) => {
    socket.emit(EVENTS.ROOM_CREATE, { displayName }, (ack) => {
      if (ack?.ok) resolve({ roomId: ack.roomId, userId: ack.userId, participants: ack.participants ?? [] });
      else reject(new Error(ack?.error || ERROR_CODES.SERVER_ERROR));
    });
  });
}

export function joinRoom(roomId, displayName, lastSequence) {
  return new Promise((resolve, reject) => {
    const payload = { roomId, displayName, ...(lastSequence != null ? { lastSequence } : {}) };
    socket.emit(EVENTS.ROOM_JOIN, payload, (ack) => {
      if (ack?.ok) resolve({ operations: ack.operations, userId: ack.userId, participants: ack.participants ?? [] });
      else reject(new Error(ack?.error || ERROR_CODES.SERVER_ERROR));
    });
  });
}
```

### 5. Client — useHomePage

**File**: `client/src/hooks/useHomePage.js`

- Add `const [displayName, setDisplayName] = useState('')`.
- Add `const [nameError, setNameError] = useState('')`.
- Validate name is non-empty (trimmed, ≤30 chars) before calling `createRoom` / `joinRoom`.
- Pass `displayName.trim()` to both calls.
- Return `displayName`, `nameError`, and `handleNameChange`.

### 6. Client — HomePage

**File**: `client/src/components/HomePage.jsx`

Add above the "Create Room" button:

```jsx
<input
  className="input input--display-name"
  type="text"
  placeholder="Your name"
  value={displayName}
  onChange={handleNameChange}
  maxLength={30}
/>
{nameError && <p className="home-page__message--error">{nameError}</p>}
```

### 7. Client — App.jsx

**File**: `client/src/App.jsx`

- `handleRoomJoined` now receives `{ roomId, userId, operations, participants }`.
- Store `participants` in state: `const [initialParticipants, setInitialParticipants] = useState([])`.
- Pass `displayName` as a prop to `RoomPage` (needed for reconnect path — `useRoom` must re-pass it on reconnect join).
- Reset on leave.

### 8. Client — useParticipants (NEW)

**File**: `client/src/hooks/useParticipants.js`

```js
import { useEffect, useState } from 'react';
import { getSocket } from '../services/socket.js';
import { SERVER_EVENTS } from 'shared/constants.js';

export function useParticipants({ initialParticipants = [] }) {
  const [participants, setParticipants] = useState(initialParticipants);
  const [isLoading, setIsLoading] = useState(initialParticipants.length === 0);

  useEffect(() => {
    const socket = getSocket();
    function onParticipantsUpdated({ participants: list }) {
      setParticipants(list);
      setIsLoading(false);
    }
    socket.on(SERVER_EVENTS.PARTICIPANTS_UPDATED, onParticipantsUpdated);
    return () => socket.off(SERVER_EVENTS.PARTICIPANTS_UPDATED, onParticipantsUpdated);
  }, []);

  return { participants, isLoading };
}
```

> **Note on `isLoading`**: If `initialParticipants` is non-empty, `isLoading` starts `false` — the panel renders immediately. If empty (edge case), it waits for the first `participants:updated` broadcast.

### 9. Client — ParticipantsPanel (NEW)

**File**: `client/src/components/ParticipantsPanel.jsx`

Key rendering logic:

```jsx
function ParticipantItem({ participant, currentUserId }) {
  const isSelf = participant.userId === currentUserId;
  return (
    <li className={`participants-panel__item${isSelf ? ' participants-panel__item--self' : ''}`}>
      {isSelf ? <strong>{participant.displayName} (You)</strong> : participant.displayName}
    </li>
  );
}
```

### 10. Client — RoomPage

**File**: `client/src/components/RoomPage.jsx`

- Add `displayName` and `initialParticipants` props.
- Call `useParticipants({ initialParticipants })`.
- Update `useRoom` call to pass `displayName` through to reconnect logic.
- Add `<ParticipantsPanel>` to render output.
- Wrap canvas area + panel in a `.room-page__body` flex-row div.

### 11. Client — CSS (NEW)

**File**: `client/src/styles/components/participantspanel.css`

```css
.participants-panel {
  width: 220px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  background-color: var(--color-surface-card);
  border-left: 1px solid var(--color-border);
  overflow: hidden;
}

.participants-panel__header {
  padding: var(--spacing-sm) var(--spacing-md);
  font-weight: var(--font-weight-bold);
  border-bottom: 1px solid var(--color-border);
  font-size: var(--font-size-sm);
  text-transform: uppercase;
  color: var(--color-text-secondary);
}

.participants-panel__list {
  flex: 1;
  overflow-y: auto;
  padding: var(--spacing-xs) 0;
  margin: 0;
  list-style: none;
}

.participants-panel__item {
  padding: var(--spacing-xs) var(--spacing-md);
  font-size: var(--font-size-base);
  color: var(--color-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.participants-panel__item--self strong {
  font-weight: var(--font-weight-bold);
  color: var(--color-primary);
}
```

Also update `.room-page__canvas-area`:

```css
/* roompage.css additions */
.room-page__body {
  flex: 1;
  display: flex;
  flex-direction: row;
  overflow: hidden;
}
```

And remove `flex: 1` from `.room-page__canvas-area` (it moves to `.room-page__body`).

### 12. useRoom — reconnect displayName

**File**: `client/src/hooks/useRoom.js`

On reconnect, the existing `joinRoom` call must also pass `displayName` so the server can re-add the user to `userDisplayNames`. Pass `displayName` as a parameter to `useRoom` and forward it to the reconnect `joinRoom` call.

---

## Running Tests

```bash
# Unit tests (client)
cd client && npm test

# Unit + integration tests (server)
cd server && npm test

# E2E
cd e2e && npx playwright test
```

All existing tests must pass unchanged before writing new tests. Write tests for:
- `useParticipants.test.js` — subscription, initial load, real-time update
- `ParticipantsPanel.test.jsx` — loading state, self-highlight, normal participants
- Server integration test — `participants:updated` emitted on join and disconnect
