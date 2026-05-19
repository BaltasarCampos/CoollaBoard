# Socket Event Contracts: Live Stroke Preview

**Feature**: `005-live-stroke-preview`  
**Date**: 2026-05-18  
**Applies to**: `shared/constants.js`, `client/src/services/socket.js`, `server/src/handlers/eventHandlers.js`

---

## Overview

This document adds five new Socket.IO events to the CoollaBoard event contract. Two events flow client → server (drawing client sends preview data), and three events flow server → client (server relays to room participants). All existing events (`room:create`, `room:join`, `draw:stroke`, `canvas:clear` and their broadcasts) are **unchanged**.

---

## New Client → Server Events

### `stroke:preview`

Emitted by the drawing client on each pointer-move during an active stroke, throttled to at most once per 30 ms. Carries the **full accumulated points array** from pointer-down to the current moment.

**Direction**: client → server  
**Constant**: `EVENTS.STROKE_PREVIEW = 'stroke:preview'`  
**Emitter**: `emitStrokePreview()` in `client/src/services/socket.js`

**Payload schema**:

```json
{
  "operationId": "<uuid-v4>",
  "userId":      "<uuid-v4>",
  "type":        "DRAW | ERASE",
  "points":      [{ "x": <number>, "y": <number> }, ...],
  "color":       "<css-hex-string>",
  "brushSize":   <number>
}
```

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `operationId` | string (UUID v4) | ✅ | Generated at pointer-down; same for all preview and commit events of this stroke |
| `userId` | string (UUID v4) | ✅ | Must match `sessions.get(socket.id).userId`; mismatched events are dropped silently |
| `type` | string | ✅ | Must be `"DRAW"` or `"ERASE"` |
| `points` | array | ✅ | Non-empty; virtual coordinates (`x`, `y` in `[0, VIRTUAL_WIDTH] × [0, VIRTUAL_HEIGHT]`) |
| `color` | string | Required for DRAW | CSS hex color (e.g., `"#111111"`); absent for ERASE |
| `brushSize` | number | Required for DRAW | Positive number in virtual units; absent for ERASE |

**Server behaviour**:
1. Look up `sessions.get(socket.id)`.
2. If `payload.userId !== session.userId` → drop event; emit `warn` log with `{ socketId, receivedUserId }` (FR-016, FR-017).
3. If `!operationId || !Array.isArray(points) || ![OP_TYPE.DRAW, OP_TYPE.ERASE].includes(type)` → drop silently.
4. Otherwise → `socket.to(session.roomId).emit(SERVER_EVENTS.STROKE_PREVIEW_BROADCAST, payload)`.
5. Preview is **not** stored in room state.

**No acknowledgement** is sent back to the emitting client.

---

### `stroke:cancel`

Emitted by the drawing client when a `pointercancel` event interrupts an active stroke. Signals all canvases to discard the in-progress preview for the given operationId.

**Direction**: client → server  
**Constant**: `EVENTS.STROKE_CANCEL = 'stroke:cancel'`  
**Emitter**: `emitStrokeCancel()` in `client/src/services/socket.js`

**Payload schema**:

```json
{
  "operationId": "<uuid-v4>",
  "userId":      "<uuid-v4>"
}
```

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `operationId` | string (UUID v4) | ✅ | Must match an active in-progress stroke for this user |
| `userId` | string (UUID v4) | ✅ | Must match `sessions.get(socket.id).userId`; mismatched events are dropped silently |

**Server behaviour**:
1. Look up `sessions.get(socket.id)`.
2. If `payload.userId !== session.userId` → drop event; emit `warn` log with `{ socketId, receivedUserId }` (FR-016, FR-017).
3. If `!operationId` → drop silently.
4. Otherwise → `socket.to(session.roomId).emit(SERVER_EVENTS.STROKE_CANCEL_BROADCAST, { operationId, userId: session.userId })`.
5. No state is stored or removed on the server (server has no preview cache).

**No acknowledgement** is sent back to the emitting client.

---

## New Server → Client Events

### `stroke:preview:broadcast`

Relayed by the server to all other users in the room when a `stroke:preview` event passes validation.

**Direction**: server → client  
**Constant**: `SERVER_EVENTS.STROKE_PREVIEW_BROADCAST = 'stroke:preview:broadcast'`  
**Listener**: `usePreviewLayer` hook in the client

**Payload schema**: identical to the validated `stroke:preview` payload received from the drawing client.

```json
{
  "operationId": "<uuid-v4>",
  "userId":      "<uuid-v4>",
  "type":        "DRAW | ERASE",
  "points":      [{ "x": <number>, "y": <number> }, ...],
  "color":       "<css-hex-string>",
  "brushSize":   <number>
}
```

**Client behaviour** (in `usePreviewLayer`):
- Call `setPreview(payload)` — upserts the `PreviewRegistry` entry keyed by `operationId`.
- The preview layer re-renders on the next RAF frame with the updated map.
- If a `draw:stroke` commit arrives for the same `operationId`, `removePreview(operationId)` is called first, then the committed operation is added to the main canvas layer via `useCanvas.addOperation`.

---

### `stroke:cancel:broadcast`

Relayed by the server to all other users in the room when a `stroke:cancel` event passes validation. Signals clients to remove the preview for the given operationId.

**Direction**: server → client  
**Constant**: `SERVER_EVENTS.STROKE_CANCEL_BROADCAST = 'stroke:cancel:broadcast'`  
**Listener**: `usePreviewLayer` hook in the client

**Payload schema**:

```json
{
  "operationId": "<uuid-v4>",
  "userId":      "<uuid-v4>"
}
```

**Client behaviour** (in `usePreviewLayer`):
- Call `removePreview(payload.operationId)`.
- The preview canvas clears the stroke on the next dirty RAF frame.

---

### `user:left`

Emitted by the server to all remaining room participants when a socket disconnects. Enables clients to clean up orphaned in-progress previews from the departed user.

**Direction**: server → client  
**Constant**: `SERVER_EVENTS.USER_LEFT = 'user:left'`  
**Emitter**: `socket.on('disconnect', ...)` handler in `eventHandlers.js`  
**Listener**: `usePreviewLayer` hook in the client

**Payload schema**:

```json
{
  "userId": "<uuid-v4>"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `userId` | string (UUID v4) | ✅ | The userId of the socket that disconnected |

**Server behaviour** (in disconnect handler):
1. Look up `session = sessions.get(socket.id)`.
2. If `session.roomId` is set: `socket.to(session.roomId).emit(SERVER_EVENTS.USER_LEFT, { userId: session.userId })`.
3. Proceed with existing `removeUserFromRoom` and `sessions.delete` calls.

**Client behaviour** (in `usePreviewLayer`):
- Remove all `PreviewRegistry` entries where `entry.userId === payload.userId`.
- The preview canvas clears those strokes on the next dirty RAF frame.

---

## Event Contract Summary Table

| Event Name | Direction | Constant | Persisted | Acknowledged |
|-----------|-----------|----------|-----------|--------------|
| `stroke:preview` | client → server | `EVENTS.STROKE_PREVIEW` | ❌ No | ❌ No |
| `stroke:cancel` | client → server | `EVENTS.STROKE_CANCEL` | ❌ No | ❌ No |
| `stroke:preview:broadcast` | server → client | `SERVER_EVENTS.STROKE_PREVIEW_BROADCAST` | ❌ No | ❌ No |
| `stroke:cancel:broadcast` | server → client | `SERVER_EVENTS.STROKE_CANCEL_BROADCAST` | ❌ No | ❌ No |
| `user:left` | server → client | `SERVER_EVENTS.USER_LEFT` | ❌ No | ❌ No |

---

## Interaction with Existing Events

| Scenario | Existing event involved | Interaction |
|----------|------------------------|-------------|
| Stroke commit after previews | `draw:stroke` (client→server) → `draw:broadcast` (server→client) | On receiving `draw:broadcast`, client calls `removePreview(op.operationId)` before calling `addOperation(op)` to avoid double-render |
| Canvas clear during preview | `canvas:clear` → `canvas:cleared` | On receiving `canvas:cleared`, client calls `clearAllPreviews()` in addition to existing CLEAR op handling |
| User joins mid-session | `room:join` → `room:state` | New joiner receives no active previews (server is stateless; next preview event arrives within 30 ms at most) |

---

## Security Notes

- **FR-016**: The server MUST validate `payload.userId === sessions.get(socket.id).userId` for `stroke:preview` and `stroke:cancel` before relaying. Mismatched events are dropped without error response to prevent information leakage.
- **FR-017**: Every dropped event due to userId mismatch MUST produce a `warn`-level log entry: `{ event, socketId, receivedUserId }`.
- Preview payloads are size-bounded by the throttle rate and the canvas virtual coordinate space. No server-side size validation is required beyond existing array type-checks.
