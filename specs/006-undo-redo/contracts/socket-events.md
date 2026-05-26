# Socket Event Contracts: Collaborative Undo / Redo

**Feature**: `006-undo-redo`
**Date**: 2026-05-20
**Applies to**: `shared/constants.js`, `client/src/services/socket.js`, `server/src/handlers/eventHandlers.js`

---

## Overview

This document adds five new Socket.IO events to the CoollaBoard event contract. Two events flow client → server (user requests undo or redo), and three events flow server → client (server broadcasts the canvas change and emits per-user availability state). All existing events (`draw:stroke`, `canvas:clear`, preview events, and their broadcasts) are **unchanged**.

---

## New Client → Server Events

### `undo:request`

Emitted by a client when the user triggers the Undo action (toolbar button or Ctrl+Z / Cmd+Z).

**Direction**: client → server
**Constant**: `EVENTS.UNDO_REQUEST = 'undo:request'`
**Emitter**: `emitUndoRequest()` in `client/src/services/socket.js`

**Payload schema**: *(empty object — no payload required)*

```json
{}
```

The server identifies the requesting user via `sessions.get(socket.id).userId`.

**Server behaviour**:
1. Look up `sessions.get(socket.id)`. If not in a room, drop silently.
2. Call `resolveUndo(session.roomId, session.userId)`.
3. If `resolveUndo` returns `null` (nothing to undo): silent no-op. No events emitted. Control on the client re-enables itself via the 5-second timeout (FR-014).
4. **If a personal DRAW/ERASE op was undone**:
   a. Emit `SERVER_EVENTS.UNDO_BROADCAST` to **all sockets in the room** (including originator): `io.to(session.roomId).emit(...)`.
   b. Compute `getUndoRedoState(session.roomId, session.userId)` and emit `SERVER_EVENTS.UNDO_STATE` to the **originating socket only**.
   c. Log at `info`: `{ event, roomId, userId, operationId, type, durationMs }`.
5. **If the room's latestClearEntry was undone**:
   a. Emit `SERVER_EVENTS.UNDO_BROADCAST` to **all sockets in the room**.
   b. For **every socket in the room**: compute `getUndoRedoState` for its userId and emit `SERVER_EVENTS.UNDO_STATE` to that socket individually (all users lose the shared clear undo option).
   c. Log at `info`: `{ event, roomId, userId, clearedByUserId, operationId, durationMs }`.

**No acknowledgement** is sent back; confirmation arrives via the broadcast.

---

### `redo:request`

Emitted by a client when the user triggers the Redo action (toolbar button or Ctrl+Y / Cmd+Y / Ctrl+Shift+Z / Cmd+Shift+Z).

**Direction**: client → server
**Constant**: `EVENTS.REDO_REQUEST = 'redo:request'`
**Emitter**: `emitRedoRequest()` in `client/src/services/socket.js`

**Payload schema**: *(empty object — no payload required)*

```json
{}
```

**Server behaviour**:
1. Look up `sessions.get(socket.id)`. If not in a room, drop silently.
2. Call `resolveRedo(session.roomId, session.userId)`.
3. If `resolveRedo` returns `null` (nothing to redo): silent no-op.
4. If a DRAW/ERASE op was re-applied:
   a. Emit `SERVER_EVENTS.REDO_BROADCAST` to **all sockets in the room**.
   b. Compute `getUndoRedoState(session.roomId, session.userId)` and emit `SERVER_EVENTS.UNDO_STATE` to the **originating socket only**.
   c. Log at `info`: `{ event, roomId, userId, operationId, type, durationMs }`.

**No acknowledgement** is sent back.

---

## New Server → Client Events

### `undo:broadcast`

Emitted by the server to all room participants when an undo operation is successfully processed. Instructs every client to remove the specified operation from its local operations array.

**Direction**: server → client (broadcast to room)
**Constant**: `SERVER_EVENTS.UNDO_BROADCAST = 'undo:broadcast'`
**Listener**: `useUndoRedo` hook in `client/src/hooks/useUndoRedo.js`

**Payload schema**:

```json
{
  "type":        "DRAW | ERASE | CLEAR",
  "operationId": "<uuid-v4>",
  "userId":      "<uuid-v4>"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | string | ✅ | The operation type that was undone. One of `"DRAW"`, `"ERASE"`, or `"CLEAR"`. |
| `operationId` | string (UUID v4) | ✅ | The `operationId` of the operation that was removed from `room.operations`. |
| `userId` | string (UUID v4) | ✅ | The user who triggered the undo (not necessarily the original op author, in the case of a clear undo). |

**Client behaviour** (in `useUndoRedo`):
- Call `removeOperation(payload.operationId)` — removes the matching entry from the `operations` array in `useCanvas`.
- For `type === 'CLEAR'`: removing the CLEAR operation from the local array means `getVisibleOperations()` will no longer treat it as a visibility boundary. Pre-clear operations already in the array become visible automatically — no additional client logic required.
- For `type === 'DRAW'` or `type === 'ERASE'`: the stroke is removed from the rendered canvas.
- If `operationId` is not present in the local array (idempotency): no-op.
- Clear the local `pending` timeout flag if the `userId` matches the local session userId.

---

### `redo:broadcast`

Emitted by the server to all room participants when a redo operation is successfully processed. Instructs every client to re-add the operation to its local operations array.

**Direction**: server → client (broadcast to room)
**Constant**: `SERVER_EVENTS.REDO_BROADCAST = 'redo:broadcast'`
**Listener**: `useUndoRedo` hook in `client/src/hooks/useUndoRedo.js`

**Payload schema**:

```json
{
  "operation": {
    "operationId":    "<uuid-v4>",
    "sequenceNumber": <number>,
    "type":           "DRAW | ERASE",
    "userId":         "<uuid-v4>",
    "points":         [{ "x": <number>, "y": <number> }, ...],
    "color":          "<css-hex-string>",
    "brushSize":      <number>,
    "timestamp":      <epoch-ms>
  },
  "userId": "<uuid-v4>"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `operation` | object | ✅ | The full `FullOperation` object (same schema as `draw:broadcast`). |
| `operation.operationId` | string (UUID v4) | ✅ | Operation identifier. |
| `operation.sequenceNumber` | number | ✅ | Original server-assigned sequence number, preserved for correct ordering. |
| `operation.type` | string | ✅ | `"DRAW"` or `"ERASE"` only — CLEAR operations are never redone (FR-005). |
| `operation.userId` | string (UUID v4) | ✅ | The user who originally performed this action. |
| `operation.points` | array | for DRAW/ERASE | Full virtual-coordinate point array. |
| `operation.color` | string | for DRAW | CSS hex color string. |
| `operation.brushSize` | number | for DRAW | Brush width in virtual units. |
| `operation.timestamp` | number | ✅ | Original server commit timestamp. |
| `userId` | string (UUID v4) | ✅ | The user who triggered the redo. |

**Client behaviour** (in `useUndoRedo`):
- Call `addOperation(payload.operation)` — adds the operation back into the `operations` array in `useCanvas`. The existing deduplication in `addOperation` handles idempotent re-adds safely.
- Clear the local `pending` timeout flag if `payload.userId` matches the local session userId.

---

### `undo:state`

Emitted by the server to a single socket to communicate the current undo/redo availability for that user. Sent proactively after every event that changes availability, including on room join/create.

**Direction**: server → client (targeted to one socket, NOT broadcast)
**Constant**: `SERVER_EVENTS.UNDO_STATE = 'undo:state'`
**Listener**: `useUndoRedo` hook in `client/src/hooks/useUndoRedo.js`

**Payload schema**:

```json
{
  "canUndo": <boolean>,
  "canRedo": <boolean>
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `canUndo` | boolean | ✅ | True when the server has at least one resolvable undo item for this user: personal undo stack is non-empty OR `room.latestClearEntry !== null`. |
| `canRedo` | boolean | ✅ | True when the server's redo stack for this user is non-empty. |

**Server sends `undo:state` in these situations**:

| Trigger | Target |
|---------|--------|
| `room:create` ack | Creating socket |
| `room:join` ack | Joining socket |
| `draw:stroke` committed | Drawing user's socket |
| `canvas:clear` committed | All sockets in the room (each with their own values) |
| `undo:request` processed (stroke undo) | Requesting socket |
| `undo:request` processed (clear undo) | All sockets in the room (each with their own values) |
| `redo:request` processed | Requesting socket |

**Client behaviour** (in `useUndoRedo`):
- Update `canUndo` and `canRedo` state.
- The Toolbar renders Undo/Redo buttons as `disabled` when the respective flag is `false`.

---

## Unchanged Events

The following events, their payloads, and their server/client behaviours are **unmodified** by this feature:

- `room:create` / `room:created`
- `room:join` / `room:state`
- `draw:stroke` / `draw:broadcast`
- `canvas:clear` / `canvas:cleared`
- `stroke:preview` / `stroke:preview:broadcast`
- `stroke:cancel` / `stroke:cancel:broadcast`
- `user:left`
- `room:error`

---

## Constants Summary (`shared/constants.js`)

```js
// Client → Server (new)
EVENTS.UNDO_REQUEST = 'undo:request'
EVENTS.REDO_REQUEST = 'redo:request'

// Server → Client (new)
SERVER_EVENTS.UNDO_BROADCAST = 'undo:broadcast'
SERVER_EVENTS.REDO_BROADCAST = 'redo:broadcast'
SERVER_EVENTS.UNDO_STATE     = 'undo:state'

// Configuration (new)
UNDO_HISTORY_DEPTH      = 20      // max undo entries per user
UNDO_CONFIRM_TIMEOUT_MS = 5000    // ms before client re-enables control on no confirmation
```
