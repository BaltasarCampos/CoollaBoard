# Socket Event Contracts: Live Stroke Preview

**Feature**: 005-live-stroke-preview  
**Date**: 2026-05-17  
**Extends**: [specs/001-coollaboard-mvp/contracts/socket-events.md](../../001-coollaboard-mvp/contracts/socket-events.md)

All event names are defined as constants in `shared/constants.js`. Direction conventions: **C→S** = client emits, server receives; **S→C** = server emits, client receives.

---

## New Events Added by This Feature

### `draw:stroke-preview` (C→S)

**Constant**: `EVENTS.DRAW_STROKE_PREVIEW`  
**Direction**: Client → Server  
**Purpose**: Communicates the current in-progress stroke state to the server for relay to other room participants. Emitted on every pointer-move that passes the 30 ms throttle gate. Never persisted.

**Payload**:
```json
{
  "operationId": "string (UUID v4)",
  "type": "DRAW | ERASE",
  "points": [{ "x": "number", "y": "number" }],
  "color": "string (hex, required when type === DRAW)",
  "brushSize": "number (positive, required when type === DRAW)"
}
```

**Constraints**:
- `operationId` must match the UUID generated at pointer-down for this stroke.
- `points` is the full accumulated array (not a delta). Each entry is in virtual coordinate space (0–1920 × 0–1080).
- Emitted at most once per 30 ms per active stroke (leading-edge throttle).
- Must NOT be emitted after `draw:stroke` or `draw:stroke-cancel` for the same `operationId`.

**Server behaviour**:
1. Validates `operationId` (non-empty string), `type` (DRAW or ERASE), `points` (non-empty array).
2. Sets `session.activePreviewId = operationId`.
3. Relays payload enriched with `userId` to all other sockets in the room via `draw:preview-broadcast`.
4. Does NOT call `addOperation()`; does NOT touch `room.operations`.
5. Logs: `{ event: 'draw:stroke-preview', roomId, userId, operationId }`.

---

### `draw:stroke-cancel` (C→S)

**Constant**: `EVENTS.DRAW_STROKE_CANCEL`  
**Direction**: Client → Server  
**Purpose**: Notifies the server that an in-progress stroke was abandoned (pointer left canvas bounds, pointer cancel, or browser focus lost). The server relays a cancel to all room participants so they can discard the preview.

**Payload**:
```json
{
  "operationId": "string (UUID v4)"
}
```

**Constraints**:
- Must only be emitted if a preview for `operationId` was previously emitted.
- Must NOT be emitted for the same `operationId` as a `draw:stroke` commit.

**Server behaviour**:
1. Validates `operationId` (non-empty string).
2. Clears `session.activePreviewId = null`.
3. Emits `draw:preview-cancel` to all other sockets in the room (not the sender).
4. Logs: `{ event: 'draw:stroke-cancel', roomId, userId, operationId }`.

---

### `draw:preview-broadcast` (S→C)

**Constant**: `SERVER_EVENTS.PREVIEW_BROADCAST`  
**Direction**: Server → Client  
**Purpose**: Delivers a remote user's in-progress stroke state to all other participants in the room.

**Payload**:
```json
{
  "operationId": "string (UUID v4)",
  "userId": "string (UUID v4)",
  "type": "DRAW | ERASE",
  "points": [{ "x": "number", "y": "number" }],
  "color": "string (hex, present when type === DRAW)",
  "brushSize": "number (present when type === DRAW)"
}
```

**Client behaviour**:
1. Upsert into `PreviewRegistry`: `previews.set(operationId, payload)`.
2. Mark canvas dirty so the renderer picks up the updated preview on the next frame.

---

### `draw:preview-cancel` (S→C)

**Constant**: `SERVER_EVENTS.PREVIEW_CANCEL`  
**Direction**: Server → Client  
**Purpose**: Instructs clients to remove a specific in-progress preview from their canvas. Emitted either when the drawing user explicitly cancels, or when the server detects their disconnection.

**Payload**:
```json
{
  "operationId": "string (UUID v4)",
  "userId": "string (UUID v4)"
}
```

**Client behaviour**:
1. Remove from `PreviewRegistry`: `previews.delete(operationId)`.
2. Mark canvas dirty.

---

## Existing Events with Behavioural Changes

### `draw:stroke` (C→S) — unchanged payload; new side-effect

When the server receives `draw:stroke` and calls `addOperation()`, it MUST clear `session.activePreviewId = null` for the sender's session. No change to payload or broadcast behaviour.

Remote clients receiving `draw:broadcast` (S→C) MUST additionally delete the matching `operationId` from their `PreviewRegistry` before rendering the committed operation. This ensures the preview is replaced atomically by the committed stroke.

### `canvas:cleared` (S→C) — unchanged payload; new side-effect

When a client receives `canvas:cleared`, it MUST call `previews.clear()` (empty the entire `PreviewRegistry`) in addition to existing clear handling. This removes all in-progress previews when the canvas is reset.

---

## Event Flow Diagrams

### Normal stroke → commit

```
User A                   Server                  User B
  │                        │                        │
  ├─ draw:stroke-preview ──►│                        │
  │                        ├─ draw:preview-broadcast─►│  (preview visible on B)
  │                        │                        │
  ├─ draw:stroke-preview ──►│                        │
  │                        ├─ draw:preview-broadcast─►│  (preview extended on B)
  │                        │                        │
  ├─ draw:stroke ──────────►│                        │
  │                        │  addOperation()         │
  │                        ├─ draw:broadcast ────────►│  (B: delete preview, render commit)
  │                        │                        │
```

### Stroke cancel (pointer-leave / cancel)

```
User A                   Server                  User B
  │                        │                        │
  ├─ draw:stroke-preview ──►│                        │
  │                        ├─ draw:preview-broadcast─►│
  │                        │                        │
  ├─ draw:stroke-cancel ───►│                        │
  │                        ├─ draw:preview-cancel ───►│  (B: delete preview, canvas clean)
  │                        │                        │
```

### User disconnect mid-stroke

```
User A                   Server                  User B
  │                        │                        │
  ├─ draw:stroke-preview ──►│                        │
  │                        ├─ draw:preview-broadcast─►│
  │                        │                        │
  ✗ (disconnect)           │                        │
                           │  session.activePreviewId set
                           ├─ draw:preview-cancel ───►│  (B: delete orphaned preview)
                           │                        │
```

---

## Constants Reference

Additions to `shared/constants.js`:

```javascript
// New client → server events
EVENTS.DRAW_STROKE_PREVIEW = 'draw:stroke-preview';
EVENTS.DRAW_STROKE_CANCEL  = 'draw:stroke-cancel';

// New server → client events
SERVER_EVENTS.PREVIEW_BROADCAST = 'draw:preview-broadcast';
SERVER_EVENTS.PREVIEW_CANCEL    = 'draw:preview-cancel';
```
