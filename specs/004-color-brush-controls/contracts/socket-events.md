# Socket Event Contracts: Color Picker and Brush Size Controls

**Phase**: 1 — Design  
**Date**: 2026-05-16  
**Branch**: `004-color-brush-controls`  
**Base contracts**: `specs/001-coollaboard-mvp/contracts/socket-events.md`

This document describes **additive changes** to the `draw:stroke` event. All other events (`room:create`, `room:join`, `canvas:clear`, and all server→client events) are **unchanged**.

---

## Updated Event: `draw:stroke` (client → server)

All fields from the MVP contract are preserved. Two optional fields are added.

**Emitted by**: `client/src/tools/penTool.js` via `client/src/services/socket.js` · `emitStroke()`  
**Handled by**: `server/src/handlers/eventHandlers.js`

### Payload

```json
{
  "operationId": "550e8400-e29b-41d4-a716-446655440000",
  "type": "DRAW",
  "points": [
    { "x": 100, "y": 200 },
    { "x": 105, "y": 210 }
  ],
  "color": "#3b82f6",
  "brushSize": 4
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `operationId` | `string` | ✅ | UUID v4 — client-generated before emit |
| `type` | `'DRAW'` \| `'ERASE'` | ✅ | Operation type. Only `DRAW` strokes carry `color` and `brushSize`. |
| `points` | `Point[]` | ✅ | Array of virtual-coordinate points (x: 0–1920, y: 0–1080) |
| `color` | `string` | ❌ | Hex color from `STROKE_PALETTE`. Present on `DRAW` strokes only. If absent, renderer falls back to `DEFAULT_STROKE_COLOR`. |
| `brushSize` | `number` | ❌ | Numeric width from `BRUSH_PRESETS` values (2, 4, or 8). Present on `DRAW` strokes only. If absent, renderer falls back to `DEFAULT_BRUSH_WIDTH`. |

### Server Handling

The server extracts `color` and `brushSize` from the payload alongside the existing fields, passes them to `roomService.addOperation`, and includes them in the stored `fullOp` object. The server performs **no validation** of `color` or `brushSize` values — it stores and rebroadcasts them verbatim.

The `addOperation` function in `roomService.js` is updated to include both fields in `fullOp`.

### Updated `draw:broadcast` (server → client)

The broadcast payload now includes `color` and `brushSize` when they were present in the original `draw:stroke`:

```json
{
  "operationId": "550e8400-e29b-41d4-a716-446655440000",
  "sequenceNumber": 7,
  "type": "DRAW",
  "userId": "7f3b2c1a-...",
  "points": [{ "x": 100, "y": 200 }, { "x": 105, "y": 210 }],
  "color": "#3b82f6",
  "brushSize": 4,
  "timestamp": 1747238400000
}
```

| Field | Type | Present | Description |
|-------|------|---------|-------------|
| `color` | `string` \| `undefined` | When original stroke included it | Hex color; `undefined` for `ERASE`/`CLEAR` ops and pre-feature `DRAW` ops |
| `brushSize` | `number` \| `undefined` | When original stroke included it | Numeric width; same presence rule as `color` |

### `room:state` (returned in `room:join` acknowledgement)

The `operations` array in the join acknowledgement now includes `color` and `brushSize` on historical `DRAW` operations where those fields were stored. Operations from before this feature will have `undefined` for both fields.

---

## `emitStroke` Function Signature (client socket service)

**File**: `client/src/services/socket.js`

```js
// Before
export function emitStroke(operationId, type, points)

// After
export function emitStroke(operationId, type, points, color, brushSize)
```

`color` and `brushSize` are optional parameters; they may be `undefined` for `ERASE` operations (callers may omit them). The function always includes them in the emitted payload object — `undefined` values are serialized by Socket.IO as absent fields.
