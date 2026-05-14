# Data Model: Codebase Refactor — Constants & Separation of Concerns

**Feature**: `002-refactor-constants-soc`  
**Date**: 2026-05-14

> This refactor introduces no new data entities, database tables, or socket payload schemas. The data model changes are limited to (a) new exports in `shared/constants.js` and (b) new typed contracts for two extracted React hooks.

---

## 1. Shared Constants Extensions

### File: `shared/constants.js`

Three new export groups are appended to the existing file. No existing exports are modified.

#### 1.1 `TOOL_NAMES`

```js
/**
 * Named identifiers for drawing tools.
 * All tool comparisons and state initialisations MUST reference these constants,
 * never bare string literals. New tools MUST be declared here before use elsewhere.
 */
export const TOOL_NAMES = {
  PEN:    'pen',
  ERASER: 'eraser',
};
```

**Validation rules**: Value strings must be lowercase, single-word identifiers. Any new tool added to the tool layer must have a corresponding entry here.

#### 1.2 `CONNECTION_STATUS`

```js
/**
 * Display labels for WebSocket connection states.
 * Values are human-readable strings used both as state identifiers and
 * as rendered text in the UI (ConnectionStatus component).
 */
export const CONNECTION_STATUS = {
  CONNECTED:    'Connected',
  RECONNECTING: 'Reconnecting',
  DISCONNECTED: 'Disconnected',
};
```

**Validation rules**: Values match the strings currently emitted by `socket.js` and rendered in `ConnectionStatus.jsx`. Changing a value here changes both the UI label and the socket-event status string simultaneously.

#### 1.3 `ERROR_CODES`

```js
/**
 * Machine-readable error code strings used in socket acknowledgement payloads
 * and client-side error handling branches.
 * Both client and server MUST use these constants when producing or consuming
 * error codes — never inline string literals.
 */
export const ERROR_CODES = {
  ROOM_NOT_FOUND: 'ROOM_NOT_FOUND',
  SERVER_ERROR:   'SERVER_ERROR',
};
```

**Validation rules**: `ROOM_NOT_FOUND` is returned by the server when `room:join` targets a non-existent room. `SERVER_ERROR` is the generic fallback for unexpected server failures on `room:create`.

---

## 2. New Hook Interfaces

### 2.1 `useHomePage` Hook

**File**: `client/src/hooks/useHomePage.js`  
**Purpose**: Encapsulates all state and logic previously inline in `HomePage.jsx`.

```
useHomePage({ onRoomJoined }) → {
  input:             string,          // current room-ID text field value
  error:             string,          // validation or socket error message
  loading:           boolean,         // true while a socket call is in flight
  handleInputChange: (event) → void,  // normalises input to uppercase, clears error
  handleCreate:      ()     → void,   // calls createRoom(), invokes onRoomJoined on success
  handleJoin:        ()     → void,   // validates then calls joinRoom(), invokes onRoomJoined on success
}
```

| Field | Type | Invariants |
|-------|------|-----------|
| `input` | `string` | Always uppercase; maxLength enforced by the input element |
| `error` | `string` | Empty string when no error; set on validation failure or socket rejection |
| `loading` | `boolean` | `true` only while an async socket call is pending |
| `handleCreate` | `function()` | Sets `loading = true`, calls `createRoom()`, calls `onRoomJoined(result)` on success, sets `error` on failure |
| `handleJoin` | `function()` | Validates against `ROOM_ID_LENGTH` + `ROOM_ID_ALPHABET`-derived pattern first; calls `joinRoom(roomId)` on pass; uses `ERROR_CODES` when mapping rejection reason |

**State transitions**:
```
idle → handleCreate() → loading=true → success → onRoomJoined called
                                     → failure → error set, loading=false
idle → handleJoin()  → validation fails → error set (no socket call)
                     → validation ok → loading=true → success → onRoomJoined called
                                                     → failure → error set, loading=false
```

### 2.2 `useCanvasRenderer` Hook

**File**: `client/src/hooks/useCanvasRenderer.js`  
**Purpose**: Owns the RAF render loop, draw/erase canvas routines, and ResizeObserver logic extracted from `Canvas.jsx`.

```
useCanvasRenderer(canvasRef, operations, getVisibleOperations) → void
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `canvasRef` | `React.RefObject<HTMLCanvasElement>` | Ref to the canvas element |
| `operations` | `Array<Operation>` | Current operations array (triggers re-render on change) |
| `getVisibleOperations` | `() → Array<Operation>` | Convergence filter from `useCanvas` |

**Internal responsibilities**:
- `dirtyRef` boolean — set to `true` when `operations` changes; cleared each rendered frame
- `requestAnimationFrame` loop — calls `renderDraw` / `renderErase` per visible op when dirty
- `ResizeObserver` — resizes canvas to `clientWidth × clientHeight` on container resize, marks dirty
- **Returns nothing** — purely a side-effect hook

**Operation shape** (unchanged from existing codebase):

```ts
{
  operationId:    string,   // UUID
  type:           OP_TYPE,  // 'DRAW' | 'ERASE' | 'CLEAR'
  userId:         string,
  points:         Array<{ x: number, y: number }>,  // virtual coordinates
  sequenceNumber: number,
  timestamp:      number,
}
```

---

## 3. Component Interface Changes

### 3.1 `Toolbar` — new `onClear` prop

| Prop | Before | After |
|------|--------|-------|
| `activeTool` | `string` | `string` (unchanged; compared via `TOOL_NAMES`) |
| `onToolChange` | `(tool: string) → void` | `(tool: string) → void` (unchanged) |
| `onClear` | *(not present)* | `() → void` — caller-supplied clear handler |
| ~~emitClear import~~ | direct socket call | removed; delegated to `onClear` prop |

**Impact**: `RoomPage` (the parent) must supply `onClear`. `RoomPage` generates the `operationId` and calls `emitClear` from within its own scope (through a thin wrapper function or `useRoom`).

### 3.2 `RoomPage` — removes direct socket imports

| Import | Before | After |
|--------|--------|-------|
| `getSocket` | imported from `socket.js` | removed (reconnect moved to `useRoom`) |
| `joinRoom` | imported from `socket.js` | removed (reconnect moved to `useRoom`) |

`useRoom` absorbs the reconnect `useEffect` (socket `'reconnect'` event + delta-hydration).

---

## 4. No-Change Entities

The following constructs are explicitly **not modified** by this refactor:

| Entity | Reason |
|--------|--------|
| Socket event payload schemas | No new events; existing schemas unchanged (see `contracts/socket-events.md`) |
| `Operation` object shape | Unchanged; convergence algorithm (`getVisibleOperations`) untouched |
| `roomService.js` data structures | Server-side room/user state untouched |
| Tool module APIs (`penTool`, `eraserTool`) | No magic literals; no SOC issues found |
| E2E test contracts | No observable behaviour changes |
