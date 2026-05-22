# Data Model: Lift Canvas State to RoomPage

**Feature**: 007-lift-canvas-state  
**Phase**: 1 — Design  
**Date**: 2026-05-22

## Overview

This refactor changes **where** state is owned, not **what** the state is. No new entities are introduced. No data schemas change. The section below documents the state ownership model before and after, and the interface contracts between components/hooks.

---

## State Ownership — Before vs After

| State | Before owner | After owner |
|---|---|---|
| `operations[]` | `useCanvas` (inside `Canvas`) + duplicate `useState` (inside `RoomPage`) | `useCanvas` (inside `RoomPage`) — single source |
| `previews` Map | `usePreviewLayer` (inside `Canvas`) | `usePreviewLayer` (inside `Canvas`) — unchanged |
| `canUndo`, `canRedo` | `useUndoRedo` (inside `Canvas`) | `useUndoRedo` (inside `RoomPage`) |
| `activeTool` | `useState` (inside `RoomPage`) | `useState` (inside `RoomPage`) — unchanged |
| `color`, `brushSize` | `useState` (inside `RoomPage`) | `useState` (inside `RoomPage`) — unchanged |

---

## Entity: Operation

Unchanged. An operation represents a discrete collaborative drawing action.

| Field | Type | Description |
|---|---|---|
| `operationId` | `string` (UUID) | Unique identifier; used for deduplication |
| `type` | `OP_TYPE` enum | `DRAW`, `ERASE`, or `CLEAR` |
| `points` | `Array<{x,y}>` | Stroke path points |
| `color` | `string` | Hex stroke colour (DRAW only) |
| `brushSize` | `number` | Stroke width in pixels (DRAW only) |
| `userId` | `string` | Author user identifier |
| `sequenceNumber` | `number` | Server-assigned logical clock value |
| `timestamp` | `number` | Unix ms timestamp |

**Validation rules** (unchanged):
- `operationId` MUST be unique per room; duplicates are silently discarded by `addOperation`
- `sequenceNumber` is used by `getVisibleOperations` to order operations after convergence

---

## Hook Interface: `useCanvas(initialOperations?)`

**After refactor** — lives in `RoomPage`.

```
Input:
  initialOperations?: Operation[]   // Optional seed for useState initial value

Returns:
  operations:          Operation[]
  addOperation:        (op: Operation) => void
  removeOperation:     (operationId: string) => void
  getVisibleOperations: () => Operation[]
```

**Listens to** (socket events, internal to hook):
- `SERVER_EVENTS.DRAW_BROADCAST` → calls `addOperation`
- `SERVER_EVENTS.CANVAS_CLEARED` → calls `addOperation` (adds the CLEAR op for convergence)

---

## Hook Interface: `useUndoRedo({ removeOperation, addOperation })`

**After refactor** — lives in `RoomPage`. Interface unchanged.

```
Input:
  removeOperation: (operationId: string) => void   // from useCanvas
  addOperation:    (op: Operation) => void         // from useCanvas

Returns:
  canUndo:      boolean
  canRedo:      boolean
  requestUndo:  () => void
  requestRedo:  () => void
```

---

## Component Interface: `Canvas` (props — after refactor)

Props that move **in** (were previously derived from internal hooks):

| Prop | Type | Previously from |
|---|---|---|
| `addOperation` | `(op) => void` | `useCanvas` inside Canvas |
| `removeOperation` | `(id) => void` | `useCanvas` inside Canvas |
| `getVisibleOperations` | `() => Operation[]` | `useCanvas` inside Canvas |
| `canUndo` | `boolean` | `useUndoRedo` inside Canvas |
| `canRedo` | `boolean` | `useUndoRedo` inside Canvas |
| `requestUndo` | `() => void` | `useUndoRedo` inside Canvas |
| `requestRedo` | `() => void` | `useUndoRedo` inside Canvas |
| `onExternalClear` | `() => void` | New — called by RoomPage's CANVAS_CLEARED side-effect |

Props that remain unchanged:

| Prop | Type | Notes |
|---|---|---|
| `activeTool` | `string` | From RoomPage tool state |
| `color` | `string` | From RoomPage tool state |
| `brushSize` | `number` | From RoomPage tool state |
| `userId` | `string` | From RoomPage |
| `roomId` | `string` | From RoomPage |

Props **removed** (no longer needed after state lift):

| Prop | Reason removed |
|---|---|
| `onToolChange` | `Toolbar` moves to `RoomPage`; Canvas no longer renders Toolbar |
| `onClear` | `Toolbar` moves to `RoomPage`; Canvas no longer renders Toolbar |
| `onColorChange` | `Toolbar` moves to `RoomPage` |
| `onBrushSizeChange` | `Toolbar` moves to `RoomPage` |
| `initialOperations` | State is initialised in `useCanvas` in `RoomPage` |

---

## Component Interface: `RoomPage` (internal state — after refactor)

```
Hooks called:
  useCanvas(initialOperations)        → { operations, addOperation, removeOperation, getVisibleOperations }
  useUndoRedo({ removeOperation, addOperation })
                                      → { canUndo, canRedo, requestUndo, requestRedo }
  useRoom({ ..., addOperations, operations, ... })
                                      → { handleClear }
  useState(TOOL_NAMES.PEN)            → [activeTool, setActiveTool]
  useState(DEFAULT_STROKE_COLOR)      → [color, setColor]
  useState(DEFAULT_BRUSH_WIDTH)       → [brushSize, setBrushSize]
  useEffect                           → CANVAS_CLEARED listener → calls onExternalClearRef (passed as prop to Canvas)

Removed:
  useState(initialOperations)         → replaced by useCanvas(initialOperations)
  addOperations callback              → replaced by addOperation from useCanvas (wrapped for plural reconnect path)
```

---

## State Transition: CANVAS_CLEARED event

```
Server emits CANVAS_CLEARED (with CLEAR operation payload)
    │
    ├──► useCanvas (in RoomPage)
    │      CANVAS_CLEARED listener: addOperation(clearOp)
    │      operations[] now includes the CLEAR op
    │      getVisibleOperations() returns [] (all ops before CLEAR discarded)
    │
    └──► RoomPage useEffect CANVAS_CLEARED listener
           calls onExternalClear()
               │
               └──► Canvas
                      onExternalClear prop → clearAllPreviews()
                      previews Map cleared → canvas-preview layer re-renders blank
```

---

## State Transition: Pointer-Up (local draw)

```
User lifts pointer on Canvas
    │
    └──► Canvas handlePointerUp
           assembles localOp = { ...penTool result, sequenceNumber: Date.now(), userId, timestamp }
           calls addOperation(localOp)   [prop from RoomPage/useCanvas]
               │
               └──► useCanvas in RoomPage
                      setOperations([...prev, localOp])
                      triggers re-render
                      Canvas receives updated getVisibleOperations() via prop
```

---

## No Changes

- `shared/constants.js` — unchanged
- Server-side code — unchanged
- Socket event schemas — unchanged
- `usePreviewLayer` — unchanged, stays in `Canvas`
- `useCanvasRenderer` — unchanged, stays in `Canvas`
- Tool singletons (`penTool`, `eraserTool`) — unchanged, stay in `Canvas`
