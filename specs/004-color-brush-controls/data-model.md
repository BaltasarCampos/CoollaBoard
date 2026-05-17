# Data Model: Color Picker and Brush Size Controls

**Phase**: 1 — Design  
**Date**: 2026-05-16  
**Plan**: [plan.md](plan.md) · **Research**: [research.md](research.md)

This document describes the data model changes introduced by this feature. The base model is defined in `specs/001-coollaboard-mvp/data-model.md`; this document specifies additive changes only.

---

## Modified Entity: DrawingOperation

The `DrawingOperation` entity gains two optional fields: `color` and `brushSize`. Both are carried in the Socket.IO payload, stored server-side in `room.operations`, and read by the canvas renderer.

```
DrawingOperation {
  operationId:    string    // unchanged — UUID v4, client-generated
  sequenceNumber: number    // unchanged — server-assigned, monotonically increasing per room
  type:           'DRAW' | 'ERASE' | 'CLEAR'  // unchanged
  userId:         string    // unchanged — session-scoped UUID
  points:         Point[]   // unchanged — DRAW/ERASE only; empty for CLEAR
  color:          string | undefined  // NEW — hex color string from STROKE_PALETTE; undefined for ERASE/CLEAR ops and pre-feature DRAW ops
  brushSize:      number | undefined  // NEW — numeric width from BRUSH_PRESETS; undefined for ERASE/CLEAR ops and pre-feature DRAW ops
  timestamp:      number    // unchanged — server-assigned unix ms
}
```

### Field Rules by Type (updated table)

| Field | DRAW | ERASE | CLEAR |
|-------|------|-------|-------|
| `operationId` | Required | Required | Required |
| `sequenceNumber` | Required | Required | Required |
| `type` | `'DRAW'` | `'ERASE'` | `'CLEAR'` |
| `userId` | Required | Required | Required |
| `points` | Required, ≥ 2 Points | Required, ≥ 1 Point | Empty array `[]` |
| `color` | Optional (hex from `STROKE_PALETTE`) | Not applicable | Not applicable |
| `brushSize` | Optional (numeric from `BRUSH_PRESETS.value`) | Not applicable | Not applicable |
| `timestamp` | Required | Required | Required |

### Validation Rules (renderer-side)

- If `color` is `undefined` or not a string: renderer uses `DEFAULT_STROKE_COLOR` (`#111111`).
- If `brushSize` is `undefined` or not a positive number: renderer uses `DEFAULT_BRUSH_WIDTH` (`4`).
- ERASE and CLEAR operations are never rendered with `color` or `brushSize`; their absence for those types is expected and correct.

---

## New Shared Constants

Defined in `shared/constants.js`. These are the authoritative values for palette membership, preset widths, and default fallbacks.

### `STROKE_PALETTE`

An ordered array of exactly 8 hex color strings representing the predefined drawing palette.

```js
// string[]  — ordered: index 0 is the default
STROKE_PALETTE = [
  '#111111', // near-black (default — index 0)
  '#ffffff', // white
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#3b82f6', // blue
  '#a855f7', // purple
]
```

**Membership rule**: A `color` value in a `DRAW` operation SHOULD be one of these 8 values. The server does not enforce this — invalid colors are stored and forwarded unchanged, with the renderer falling back to `DEFAULT_STROKE_COLOR`.

### `BRUSH_PRESETS`

An ordered array of 3 preset objects mapping UI label to numeric width.

```js
// Array<{ label: string, value: number }>
BRUSH_PRESETS = [
  { label: 'S', value: 2 },
  { label: 'M', value: 4 },  // default
  { label: 'L', value: 8 },
]
```

**Value rule**: `brushSize` in a `DRAW` operation SHOULD be one of `2`, `4`, or `8`. The renderer falls back to `DEFAULT_BRUSH_WIDTH` for unrecognized values.

### `DEFAULT_STROKE_COLOR`

```js
DEFAULT_STROKE_COLOR = '#111111'
```

Replaces the previous `STROKE_COLOR = '#000000'` constant. All references to `STROKE_COLOR` in `useCanvasRenderer.js` are updated to `DEFAULT_STROKE_COLOR`.

### `DEFAULT_BRUSH_WIDTH`

```js
DEFAULT_BRUSH_WIDTH = 4
```

Explicit constant for renderer fallback. Numerically equal to the existing `BRUSH_WIDTH = 4` (which remains for backward compatibility with the eraser tool's own rendering logic).

---

## Toolbar Drawing State (Client-Side, Non-Persisted)

This is not a stored entity but a session-scoped UI state value held in `RoomPage.jsx` React state.

```
ToolbarDrawingState {
  color:    string  // current hex value; initialized to DEFAULT_STROKE_COLOR
  brushSize: number // current numeric width; initialized to DEFAULT_BRUSH_WIDTH
}
```

**Lifecycle**:
1. Initialized with `DEFAULT_STROKE_COLOR` and `DEFAULT_BRUSH_WIDTH` when `RoomPage` mounts.
2. Updated by user interaction with the Toolbar color picker or brush size buttons.
3. Read at pointer-up time by the `handlePointerUp` callback in `Canvas.jsx` and passed to `penTool.onPointerUp`.
4. Not persisted across page reloads or room rejoins.

**Ownership**: `RoomPage.jsx` (via `useState`). Passed down as props to `Toolbar.jsx` (display + control) and `Canvas.jsx` (stroke emission).
