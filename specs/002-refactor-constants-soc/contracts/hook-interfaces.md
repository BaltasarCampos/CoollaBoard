# Hook Interfaces Contract

**Feature**: `002-refactor-constants-soc`  
**Date**: 2026-05-14  
**Scope**: Internal React hook public APIs introduced by this refactor

---

## Overview

This document defines the public interface contracts for the two new React hooks introduced by this feature. These contracts govern how components interact with the hooks and what the hooks guarantee to their callers. The existing socket-event contracts are unchanged (see `specs/001-coollaboard-mvp/contracts/socket-events.md`).

---

## `useHomePage`

### Location
`client/src/hooks/useHomePage.js`

### Signature

```js
function useHomePage({ onRoomJoined }): {
  input:             string;
  error:             string;
  loading:           boolean;
  handleInputChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  handleCreate:      () => void;
  handleJoin:        () => void;
}
```

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `onRoomJoined` | `(result: RoomJoinedResult) => void` | Yes | Callback invoked after a successful create or join. Receives `{ roomId, userId, operations }`. |

### Return Value

| Field | Type | Description |
|-------|------|-------------|
| `input` | `string` | Current value of the room-ID text input (always uppercase). |
| `error` | `string` | Human-readable error message; empty string when none. |
| `loading` | `boolean` | `true` while a socket call is in-flight. |
| `handleInputChange` | `function(event)` | Updates `input` to `event.target.value.toUpperCase()`; clears `error`. |
| `handleCreate` | `function()` | Initiates room creation via `createRoom()`; sets `loading` during the call; calls `onRoomJoined` on success; sets `error` on failure. |
| `handleJoin` | `function()` | Validates `input` against `ROOM_ID_LENGTH` and `ROOM_ID_ALPHABET`; on pass, calls `joinRoom(input)`; sets `loading` during the call; calls `onRoomJoined` on success; sets `error` (including `ERROR_CODES` mapping) on failure. |

### Guarantees

1. `loading` is `false` when the hook is first rendered.
2. `handleCreate` and `handleJoin` are no-ops while `loading === true` (guard against double submission).
3. `error` is always cleared when `handleInputChange` is called.
4. Validation in `handleJoin` checks length (`ROOM_ID_LENGTH`) before pattern, so error messages are ordered deterministically.
5. The `ROOM_NOT_FOUND` error from socket rejection is mapped to a human-readable string, not exposed as a raw error code.

### Violations / Non-Guarantees

- Does not debounce `handleInputChange`.
- Does not persist state across remounts.

---

## `useCanvasRenderer`

### Location
`client/src/hooks/useCanvasRenderer.js`

### Signature

```js
function useCanvasRenderer(
  canvasRef:           React.RefObject<HTMLCanvasElement>,
  operations:          Operation[],
  getVisibleOperations: () => Operation[]
): void
```

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `canvasRef` | `RefObject<HTMLCanvasElement>` | Yes | Ref to the `<canvas>` element. Hook is a no-op until `canvasRef.current` is non-null. |
| `operations` | `Operation[]` | Yes | Full operations array. Changes to this array trigger a dirty-flag set on the next frame. |
| `getVisibleOperations` | `() => Operation[]` | Yes | Convergence-filtered, sequence-sorted operation list from `useCanvas`. Called once per dirty render frame. |

### Return Value

`void` — this hook is entirely side-effect driven.

### Internal Side Effects

| Effect | Trigger | Cleanup |
|--------|---------|---------|
| RAF render loop starts | `canvasRef.current` non-null | `cancelAnimationFrame` on unmount |
| `dirtyRef = true` | `operations` array reference changes | — |
| `ResizeObserver` attached | `canvasRef.current` non-null | `observer.disconnect()` on unmount |
| Canvas `width`/`height` set | `ResizeObserver` fires | — |

### Rendering Behaviour

- **DRAW op**: strokes path through `op.points` using `STROKE_COLOR`, `BRUSH_WIDTH`, `lineCap: 'round'`, `lineJoin: 'round'`. Ops with fewer than 2 points are skipped.
- **ERASE op**: for each point, `clearRect` with radius `ERASER_RADIUS * (canvas.clientWidth / VIRTUAL_WIDTH)`.
- **CLEAR op**: handled upstream by `getVisibleOperations` (ops before last CLEAR are excluded); no special rendering in this hook.

### Guarantees

1. The canvas is fully cleared (`clearRect`) before each re-render pass.
2. Only `getVisibleOperations()` output is rendered (convergence guarantee delegated to `useCanvas`).
3. The RAF loop runs at most once per animation frame; no frame is skipped unless the canvas is not dirty.
4. `ResizeObserver` marks the canvas dirty after every resize, ensuring re-render on container size changes.

---

## `useRoom` — Reconnect Extension

### Change

The existing `useRoom` hook (`client/src/hooks/useRoom.js`) is extended to absorb the reconnect logic currently inline in `RoomPage.jsx`.

### New Behaviour

When the socket emits `'reconnect'`:
1. Compute `lastSequence` from the latest `sequenceNumber` across current operations.
2. Call `joinRoom(roomId, lastSequence)` to fetch delta operations.
3. Call `addOperations(delta)` if delta is non-empty.
4. On failure (`ROOM_NOT_FOUND`), call `onLeaveRoom('room no longer exists')`.

### Parameters (unchanged from existing)

```js
function useRoom({ roomId, userId, lastSequence, onRoomJoined, onLeaveRoom, addOperations })
```

`addOperations` is a new optional parameter passed from `RoomPage` to enable the hook to push delta ops into the shared operations state.

### Caller Impact

`RoomPage` must pass `addOperations` and remove its own reconnect `useEffect`. It also removes `getSocket` and `joinRoom` imports from `socket.js`.

---

## Unchanged Contracts

The following contracts from the MVP spec remain **completely unchanged**:

- **Socket events** (`EVENTS`, `SERVER_EVENTS`) — same names, same payloads. See `specs/001-coollaboard-mvp/contracts/socket-events.md`.
- **Tool module API** (`penTool`, `eraserTool`) — no interface changes.
- **`useCanvas` return value** — `{ operations, addOperation, getVisibleOperations }` — unchanged.
