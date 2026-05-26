# Data Model: Participants Panel

**Feature**: `008-participants-panel`  
**Phase**: 1 — Design

---

## New Entity: Participant

Represents a user currently connected to a room.

| Field | Type | Source | Notes |
|---|---|---|---|
| `userId` | `string` (UUID) | Server-generated on socket connect | Stable for the lifetime of the socket connection |
| `displayName` | `string` (1–30 chars) | Client-provided on room create/join | Trimmed; forwarded verbatim by server |

---

## Server: Room Object (additions)

**File**: `server/src/services/roomService.js`

The existing `room` object gains one new field:

| Field | Type | Before | After |
|---|---|---|---|
| `userDisplayNames` | `Map<userId, displayName>` | — | Added; stores display name for each connected user |

`connectedUsers: Set<userId>` is **unchanged** — it remains the authoritative set for membership checks. `userDisplayNames` is a parallel map for name lookups.

### Updated function signatures

```js
// roomService.js

// CHANGED: accepts displayName
addUserToRoom(roomId, userId, displayName)

// UNCHANGED signature; now also deletes from userDisplayNames
removeUserFromRoom(roomId, userId)

// NEW: returns ordered participant list
getParticipants(roomId) → Array<{ userId: string, displayName: string }>
```

---

## Server: Session Entry (addition)

**File**: `server/src/handlers/eventHandlers.js`

The `sessions` Map entry gains one field:

```js
// Before
{ userId: string, roomId: string | null }

// After
{ userId: string, roomId: string | null, displayName: string | null }
```

`displayName` is `null` until the client sends it in `room:create` or `room:join`.

---

## Shared Constants (additions)

**File**: `shared/constants.js`

```js
// SERVER_EVENTS additions
SERVER_EVENTS.PARTICIPANTS_UPDATED = 'participants:updated'
```

No new client → server events. Display name is carried as a new optional field in the existing `room:create` and `room:join` payloads (see contracts).

---

## New Hook: useParticipants

**File**: `client/src/hooks/useParticipants.js`

| Property | Type | Description |
|---|---|---|
| `participants` | `Array<{ userId, displayName }>` | Current participant list; `[]` while loading |
| `isLoading` | `boolean` | `true` until first authoritative list received |

**Inputs** (parameters):
| Parameter | Type | Description |
|---|---|---|
| `initialParticipants` | `Array<{ userId, displayName }>` | From join/create ack; may be `[]` |

**State transitions**:
1. Mounted with `initialParticipants` provided (non-null array, including `[]`) → sets `participants = initialParticipants`, `isLoading = false` immediately. No loading state is shown when the ack data is available.
2. Mounted without `initialParticipants` (null/undefined) → sets `participants = null`, `isLoading = true` until the first `participants:updated` event is received.
3. `participants:updated` received → sets `participants` to the new array and `isLoading = false`.
4. Unmounted → unsubscribes from `participants:updated`.

---

## New Component: ParticipantsPanel

**File**: `client/src/components/ParticipantsPanel.jsx`

### Props

| Prop | Type | Required | Description |
|---|---|---|---|
| `participants` | `Array<{ userId, displayName }>` | yes | Current list from `useParticipants` |
| `currentUserId` | `string` | yes | The local user's userId; used for "(You)" label |
| `isLoading` | `boolean` | yes | When `true`, renders loading text instead of list |

### Rendering rules
- When `isLoading` is `true`: render `<p>Loading…</p>`.
- When list is empty: render `<p>No participants</p>` (defensive; should not happen in normal flow).
- For each participant where `userId === currentUserId`: render name in bold with " (You)" suffix.
- All other participants: render name in normal weight.
- List scrolls internally when content overflows; panel maintains a fixed height.

---

## Updated Component: HomePage

**File**: `client/src/components/HomePage.jsx`

New display-name `<input>` field added above the room action buttons. Validation on submit: name must be non-empty after trim (1–30 chars). Error shown inline using existing `.home-page__message--error` class.

### Updated hook: useHomePage

| New state | Type | Description |
|---|---|---|
| `displayName` | `string` | Controlled input value |
| `nameError` | `string` | Inline validation error for name field |

`handleCreate` and `handleJoin` both pass `displayName` to `createRoom` / `joinRoom`.

---

## Updated Service: socket.js

```js
// Signature changes
createRoom(displayName: string) → Promise<{ roomId, userId, participants }>
joinRoom(roomId: string, displayName: string, lastSequence?: number) → Promise<{ operations, userId, participants }>
```

Both functions receive `participants: Array<{ userId, displayName }>` from the server ack.

---

## Updated Component: RoomPage

**File**: `client/src/components/RoomPage.jsx`

New props:

| Prop | Type | Description |
|---|---|---|
| `displayName` | `string` | The current user's display name |
| `initialParticipants` | `Array<{ userId, displayName }>` | Seeded from join/create ack |

`RoomPage` instantiates `useParticipants({ initialParticipants })` and renders `<ParticipantsPanel participants={participants} currentUserId={userId} isLoading={isLoading} />`.

---

## Layout Change: RoomPage

`.room-page` layout changes from a single flex-column to accommodate the sidebar:

```
.room-page (flex: column)
  .room-page__header
  .room-page__body (flex: row, flex: 1)          ← NEW wrapper
    .room-page__canvas-area (flex: 1)
    .participants-panel (width: 220px, fixed)
  ConnectionStatus
```
