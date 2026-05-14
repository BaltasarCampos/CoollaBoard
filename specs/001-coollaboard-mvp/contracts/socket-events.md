# Socket.IO Event Contracts: CoollaBoard MVP

**Phase**: 1 — Design & Contracts  
**Date**: 2026-05-14  
**Plan**: [../plan.md](../plan.md) · **Data Model**: [../data-model.md](../data-model.md)

Event names are defined as constants in `shared/constants.js` (`EVENTS` and `SERVER_EVENTS`).  
All payloads are JSON objects transported over the default Socket.IO binary serialisation.  
Schema version is implicit at `v1` for the MVP; breaking changes require a new version field.

---

## Naming Convention

```
<domain>:<action>       — client → server  (command intent)
<domain>:<past-tense>   — server → client  (fact / broadcast)
```

---

## Client → Server Events

### `room:create`

Create a new drawing room. No payload required.

**Emitted by**: `client/src/services/socket.js` · `createRoom()`  
**Handled by**: `server/src/handlers/eventHandlers.js`

**Payload**: _(none / empty object)_

```json
{}
```

**Acknowledgement** (Socket.IO callback):

Success:
```json
{ "ok": true, "roomId": "A3F9KZ" }
```

Error:
```json
{ "ok": false, "error": "SERVER_ERROR", "message": "Failed to generate room" }
```

---

### `room:join`

Join an existing room and receive current canvas state.

**Emitted by**: `client/src/services/socket.js` · `joinRoom(roomId, lastSequence?)`  
**Handled by**: `server/src/handlers/eventHandlers.js`

**Payload**:

```json
{
  "roomId": "A3F9KZ",
  "lastSequence": 42
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `roomId` | `string` | ✅ | 6-char room identifier (pre-validated client-side) |
| `lastSequence` | `number` | ❌ | Client's last known `sequenceNumber`; omit / `0` for full state |

**Acknowledgement**:

Success (full state, `lastSequence` = 0 or omitted):
```json
{
  "ok": true,
  "operations": [
    {
      "operationId": "550e8400-e29b-41d4-a716-446655440000",
      "sequenceNumber": 1,
      "type": "DRAW",
      "userId": "7f3b2c1a-...",
      "points": [{ "x": 100, "y": 200 }, { "x": 105, "y": 210 }],
      "timestamp": 1747238400000
    }
  ]
}
```

Success (delta state, `lastSequence` > 0, only operations after `lastSequence` returned):
```json
{ "ok": true, "operations": [ /* operations with sequenceNumber > lastSequence */ ] }
```

Error — room not found:
```json
{ "ok": false, "error": "ROOM_NOT_FOUND", "message": "Room A3F9KZ does not exist" }
```

Error — server error:
```json
{ "ok": false, "error": "SERVER_ERROR", "message": "Internal error" }
```

---

### `draw:stroke`

Submit a completed freehand drawing or erasing stroke. One event per mouse-up (end of stroke).

**Emitted by**: `client/src/tools/penTool.js` · `client/src/tools/eraserTool.js` via `socket.js`  
**Handled by**: `server/src/handlers/eventHandlers.js`

**Payload**:

```json
{
  "operationId": "550e8400-e29b-41d4-a716-446655440000",
  "type": "DRAW",
  "points": [
    { "x": 100, "y": 200 },
    { "x": 110, "y": 215 },
    { "x": 125, "y": 230 }
  ]
}
```

| Field | Type | Required | Values | Description |
|-------|------|----------|--------|-------------|
| `operationId` | `string` | ✅ | UUID v4 | Client-generated; used for deduplication and local echo |
| `type` | `string` | ✅ | `"DRAW"` \| `"ERASE"` | Tool used for this stroke |
| `points` | `Point[]` | ✅ | ≥ 2 (`DRAW`) · ≥ 1 (`ERASE`) | Virtual-space coordinates in pointer-event order |

**Acknowledgement**: _(none — fire-and-forget with optimistic local rendering)_

**Server behaviour**:
1. Validate payload (roomId from session, `operationId` not duplicate, `type` valid, `points` non-empty).
2. Assign `sequenceNumber` (increment `Room.nextSequence`).
3. Append to `Room.operations`.
4. Broadcast `draw:broadcast` to all other sockets in the room (excluding sender).
5. Log structured JSON.
6. Silently discard duplicate `operationId`.

---

### `canvas:clear`

Clear the entire canvas for all participants. Requires prior user confirmation (UI-level, not protocol-level).

**Emitted by**: `client/src/tools/clearTool.js` via `socket.js`  
**Handled by**: `server/src/handlers/eventHandlers.js`

**Payload**:

```json
{
  "operationId": "6ba7b810-9dad-11d1-80b4-00c04fd430c8"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `operationId` | `string` | ✅ | UUID v4, client-generated |

**Acknowledgement**: _(none — fire-and-forget)_

**Server behaviour**:
1. Validate: socket is in a room, `operationId` not duplicate.
2. Assign `sequenceNumber`.
3. Append `{ operationId, sequenceNumber, type: 'CLEAR', userId, points: [], timestamp }` to `Room.operations`.
4. Broadcast `canvas:cleared` to **all** sockets in the room (including sender).
5. Log structured JSON.

---

## Server → Client Events

### `draw:broadcast`

A drawing or erasing stroke from another user, broadcast to all room participants except the sender.

**Emitted by**: `server/src/handlers/eventHandlers.js` on `draw:stroke` (to room except sender)  
**Received by**: `client/src/hooks/useRoom.js` · `client/src/hooks/useCanvas.js`

**Payload**:

```json
{
  "operationId": "550e8400-e29b-41d4-a716-446655440000",
  "sequenceNumber": 7,
  "type": "DRAW",
  "userId": "7f3b2c1a-...",
  "points": [
    { "x": 100, "y": 200 },
    { "x": 110, "y": 215 }
  ],
  "timestamp": 1747238400000
}
```

| Field | Type | Description |
|-------|------|-------------|
| `operationId` | `string` | UUID v4 |
| `sequenceNumber` | `number` | Server-assigned, monotonically increasing per room |
| `type` | `string` | `"DRAW"` or `"ERASE"` |
| `userId` | `string` | Originating user's session UUID |
| `points` | `Point[]` | Virtual-space coordinates |
| `timestamp` | `number` | Unix ms, server-assigned |

**Client behaviour**: Append operation to local operations array (maintaining sequence order); mark canvas dirty for next redraw.

---

### `canvas:cleared`

Broadcast to all room participants (including the sender) when a `canvas:clear` operation is processed.

**Emitted by**: `server/src/handlers/eventHandlers.js` on `canvas:clear` (to entire room)  
**Received by**: `client/src/hooks/useRoom.js` · `client/src/hooks/useCanvas.js`

**Payload**:

```json
{
  "operationId": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
  "sequenceNumber": 12,
  "userId": "7f3b2c1a-...",
  "timestamp": 1747238401000
}
```

| Field | Type | Description |
|-------|------|-------------|
| `operationId` | `string` | UUID v4 |
| `sequenceNumber` | `number` | Server-assigned |
| `userId` | `string` | User who triggered the clear |
| `timestamp` | `number` | Unix ms |

**Client behaviour**: Append `CLEAR` operation to local operations array; mark canvas dirty; next redraw applies the convergence algorithm (discard all ops before the last CLEAR).

---

### `room:error`

Informational error pushed to a specific client (not broadcast). Used for rejections that occur after the initial `room:join` acknowledgement (e.g., if a socket emits `draw:stroke` before joining a room).

**Emitted by**: `server/src/handlers/eventHandlers.js`  
**Received by**: `client/src/hooks/useRoom.js`

**Payload**:

```json
{
  "code": "NOT_IN_ROOM",
  "message": "You must join a room before drawing"
}
```

**Error codes**:

| Code | Trigger |
|------|---------|
| `NOT_IN_ROOM` | `draw:stroke` or `canvas:clear` emitted before `room:join` |
| `ROOM_NOT_FOUND` | `room:join` for a non-existent room (also returned in ack) |
| `INVALID_PAYLOAD` | Payload validation failure on any event |
| `SERVER_ERROR` | Unexpected server-side error |

---

## Event Flow Diagrams

### Room Creation

```
Client                       Server
  │                             │
  │──── room:create ───────────▶│
  │                             │ generate roomId
  │                             │ create Room in memory
  │◀─── ack { ok, roomId } ─────│
  │                             │
  │ navigate to /room/:roomId   │
```

### Room Join (full hydration)

```
Client                       Server
  │                             │
  │──── room:join ─────────────▶│
  │     { roomId, lastSequence:0}│
  │                             │ look up Room
  │                             │ socket joins room socket group
  │◀─── ack { ok, operations[] }│
  │                             │
  │ replay operations           │
  │ mark canvas dirty           │
```

### Drawing Stroke (real-time sync)

```
Client A                     Server                    Client B
  │                             │                          │
  │ pointer events              │                          │
  │ local optimistic render     │                          │
  │──── draw:stroke ───────────▶│                          │
  │     { operationId, DRAW,    │                          │
  │       points[] }            │                          │
  │                             │ deduplicate              │
  │                             │ assign sequenceNumber    │
  │                             │ append to Room.operations│
  │                             │──── draw:broadcast ─────▶│
  │                             │     { opId, seq, DRAW,  │
  │                             │       points[] }         │
  │                             │                          │ append to local ops
  │                             │                          │ mark canvas dirty
```

### Reconnection Flow

```
Client                       Server
  │                             │
  │ [socket disconnect]         │
  │ status → RECONNECTING       │
  │                             │ [grace period starts if last user]
  │ [socket reconnect]          │
  │──── room:join ─────────────▶│
  │     { roomId,               │
  │       lastSequence: N }      │
  │                             │
  │◀─── ack { ok, ops after N } │
  │ status → CONNECTED          │
```

---

## Non-Events: Implicit Socket.IO Lifecycle

| Socket.IO Event | Client handling |
|----------------|----------------|
| `connect` | Set status = CONNECTED; if `currentRoomId` set, emit `room:join` (reconnect path) |
| `disconnect` | Set status = RECONNECTING |
| `connect_error` | Set status = DISCONNECTED after backoff exhausted (handled by Socket.IO `reconnection_failed`) |
