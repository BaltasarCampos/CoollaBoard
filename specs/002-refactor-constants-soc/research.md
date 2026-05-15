# Research: Codebase Refactor — Constants & Separation of Concerns

**Feature**: `002-refactor-constants-soc`  
**Date**: 2026-05-14

---

## 1. Audit of Magic Literals in Client Code

### Findings

Exhaustive search of all files under `client/src/` against values already expressible via `shared/constants.js`:

| File | Literal | Constant to use |
|------|---------|----------------|
| `components/HomePage.jsx` | `/^[A-Z0-9]{6}$/` | Build pattern from `ROOM_ID_LENGTH` + `ROOM_ID_ALPHABET` |
| `components/HomePage.jsx` | `roomId.length !== 6` | `ROOM_ID_LENGTH` |
| `components/HomePage.jsx` | `err.message === 'ROOM_NOT_FOUND'` | `ERROR_CODES.ROOM_NOT_FOUND` (new) |
| `components/RoomPage.jsx` | `useState('pen')` | `TOOL_NAMES.PEN` (new) |
| `components/RoomPage.jsx` | `data?.error === 'ROOM_NOT_FOUND'` | `ERROR_CODES.ROOM_NOT_FOUND` (new) |
| `components/Canvas.jsx` | `activeTool === 'pen'` (×3) | `TOOL_NAMES.PEN` (new) |
| `components/Canvas.jsx` | `activeTool === 'eraser'` (×3) | `TOOL_NAMES.ERASER` (new) |
| `components/Toolbar.jsx` | `onToolChange('pen')` | `TOOL_NAMES.PEN` (new) |
| `components/Toolbar.jsx` | `onToolChange('eraser')` | `TOOL_NAMES.ERASER` (new) |
| `components/Toolbar.jsx` | `activeTool === 'pen'` | `TOOL_NAMES.PEN` (new) |
| `components/Toolbar.jsx` | `activeTool === 'eraser'` | `TOOL_NAMES.ERASER` (new) |
| `components/ConnectionStatus.jsx` | `'Connected'` (STYLES key + useState) | `CONNECTION_STATUS.CONNECTED` (new) |
| `components/ConnectionStatus.jsx` | `'Reconnecting'` (STYLES key) | `CONNECTION_STATUS.RECONNECTING` (new) |
| `components/ConnectionStatus.jsx` | `'Disconnected'` (STYLES key + useState) | `CONNECTION_STATUS.DISCONNECTED` (new) |
| `services/socket.js` | `emitStatus('Connected')` | `CONNECTION_STATUS.CONNECTED` (new) |
| `services/socket.js` | `emitStatus('Disconnected')` | `CONNECTION_STATUS.DISCONNECTED` (new) |
| `services/socket.js` | `emitStatus('Reconnecting')` | `CONNECTION_STATUS.RECONNECTING` (new) |
| `services/socket.js` | `socket.connected ? 'Connected' : 'Disconnected'` | `CONNECTION_STATUS.*` (new) |
| `hooks/useRoom.js` | `err.message === 'ROOM_NOT_FOUND'` | `ERROR_CODES.ROOM_NOT_FOUND` (new) |

**Decision**: All literals above are candidates for replacement. The socket server URL (`http://localhost:3001`) is explicitly out of scope (spec Assumptions).

---

## 2. Audit of Magic Literals in Server Code

| File | Literal | Constant to use |
|------|---------|----------------|
| `handlers/eventHandlers.js` | `ack({ ..., error: 'SERVER_ERROR' })` | `ERROR_CODES.SERVER_ERROR` (new) |
| `handlers/eventHandlers.js` | `ack({ ..., error: 'ROOM_NOT_FOUND' })` | `ERROR_CODES.ROOM_NOT_FOUND` (new) |

---

## 3. New Constant Groups Required

### Decision

Three new top-level exports must be added to `shared/constants.js`:

```js
export const TOOL_NAMES = {
  PEN:    'pen',
  ERASER: 'eraser',
};

export const CONNECTION_STATUS = {
  CONNECTED:    'Connected',
  RECONNECTING: 'Reconnecting',
  DISCONNECTED: 'Disconnected',
};

export const ERROR_CODES = {
  ROOM_NOT_FOUND: 'ROOM_NOT_FOUND',
  SERVER_ERROR:   'SERVER_ERROR',
};
```

**Rationale**: These groups mirror the existing pattern of `EVENTS`, `SERVER_EVENTS`, and `OP_TYPE` — named-constant objects with string values, exported from `shared/constants.js`.

**Alternatives considered**:
- Separate per-domain constants files (`client/src/constants/tools.js`, etc.) — rejected because the spec Assumptions section explicitly state `shared/constants.js` is the authoritative location.
- Enum-like frozen objects (`Object.freeze(...)`) — optional but not required; the existing constants are not frozen.

---

## 4. Separation of Concerns Audit

### 4.1 `HomePage` component

**Current**: Mixes JSX, form state (`input`, `error`, `loading`), input validation (regex), and direct socket calls (`createRoom`, `joinRoom`).

**Decision**: Extract `useHomePage` hook carrying:
- `input`, `error`, `loading` state
- `handleInputChange`, `handleCreate`, `handleJoin` handlers
- Validation against `ROOM_ID_LENGTH` and a pattern derived from `ROOM_ID_ALPHABET`
- Socket calls (`createRoom`, `joinRoom`) delegated from the hook

**Rationale**: The component reduces to pure JSX + event-binding. The hook is independently testable (no DOM required).

**Alternatives considered**:
- Inline validation utility (pure function, no state) — rejected because state (`loading`, `error`) naturally belongs with the validation/action handlers in a single cohesive hook.

### 4.2 `RoomPage` component

**Current**: Imports `getSocket` and `joinRoom` directly for reconnect/delta-hydration logic, putting socket lifecycle in a component.

**Decision**: Move the reconnect `useEffect` (socket.on `'reconnect'` + `SERVER_EVENTS.ROOM_ERROR`) into `useRoom` hook (extends FR-004). `RoomPage` removes its direct socket imports.

**Rationale**: `useRoom` already handles initial join/create; reconnect is the same concern. The existing hook already subscribes to `ROOM_ERROR`; the reconnect logic is a natural extension.

**Alternatives considered**:
- New `useRoomReconnect` hook — rejected as over-engineering; the logic is small and belongs in `useRoom`.

### 4.3 `Canvas` component

**Current**: `renderDraw`, `renderErase` functions and `ResizeObserver` logic defined inline inside the component, making the component ~130 lines and untestable in isolation.

**Decision**: Extract `useCanvasRenderer(canvasRef, operations, getVisibleOperations)` hook that owns:
- The `requestAnimationFrame` render loop
- `renderDraw` and `renderErase` routines
- The `ResizeObserver` resize logic
- `dirtyRef` tracking

`Canvas` component retains only the canvas element + pointer event handlers.

**Rationale**: The rendering routines are pure canvas-drawing logic with no React component dependency — they are naturally testable as a hook that accepts refs. FR-005 explicitly requires this extraction.

**Alternatives considered**:
- Standalone utility file (`canvasRenderer.js`) — viable, but a hook is a better fit because `dirtyRef` and the RAF loop are stateful and tied to component lifecycle.

### 4.4 `Toolbar` component

**Current**: `handleConfirmClear` calls `crypto.randomUUID()` and `emitClear(operationId)` directly.

**Decision**: Pass `onClear` prop from `RoomPage` (which calls through to a hook), OR expose a `useClear` helper from within `useCanvas`/`useRoom`. Since `emitClear` is a fire-and-forget socket call, the simplest compliant solution is: `Toolbar` receives an `onClear` callback prop from its parent (`RoomPage`), which delegates to the socket service via `useRoom` or a thin wrapper. This removes Toolbar's direct socket import.

**Rationale**: Toolbar should not know about sockets (Constitution VI). The operationId generation (`crypto.randomUUID()`) is business logic that belongs in the hook or parent. Passing a prop keeps Toolbar purely presentational.

**Alternatives considered**:
- `useClearCanvas` hook inside Toolbar — rejected; Toolbar has no state of its own; passing a prop is simpler and avoids an unnecessary hook.

---

## 5. `ROOM_ID_PATTERN` Derivation Strategy

**Current**: `const ROOM_ID_PATTERN = /^[A-Z0-9]{6}$/;` hardcoded in `HomePage.jsx`.

**Decision**: Derive dynamically from constants inside `useHomePage`:

```js
import { ROOM_ID_LENGTH, ROOM_ID_ALPHABET } from 'shared/constants.js';

// Build character class from alphabet, e.g. "[ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789]"
const charClass = `[${ROOM_ID_ALPHABET}]`;
const ROOM_ID_PATTERN = new RegExp(`^${charClass}{${ROOM_ID_LENGTH}}$`);
```

**Rationale**: If `ROOM_ID_ALPHABET` or `ROOM_ID_LENGTH` change, the validation pattern updates automatically. No special-character escaping needed because the current alphabet contains only safe regex chars.

**Alternatives considered**:
- Export `ROOM_ID_PATTERN` from `shared/constants.js` — viable, but `RegExp` objects are not JSON-serialisable and may cause issues in server contexts; keeping the regex derived client-side from simpler string constants is cleaner.

---

## 6. Test Strategy for New Hooks

**Required by Constitution I and SC-005**:

| Hook | Test file | What to cover |
|------|-----------|--------------|
| `useHomePage` | `client/tests/unit/useHomePage.test.js` | validation (too short, too long, invalid chars, valid), create-room success/failure, join-room success/failure |
| `useCanvasRenderer` | `client/tests/unit/useCanvasRenderer.test.js` | renderDraw called when op is DRAW type; renderErase called when op is ERASE type; CLEAR op causes prior ops to be skipped (delegates to getVisibleOperations) |

Tests use `renderHook` from `@testing-library/react`. Socket calls are mocked.

---

## 7. Unchanged Files

The following files require **no changes** and are confirmed clean:

- `client/src/tools/penTool.js` — uses `OP_TYPE` and `emitStroke`; no magic literals
- `client/src/tools/eraserTool.js` — same pattern
- `client/src/hooks/useCanvas.js` — already uses `SERVER_EVENTS`, `OP_TYPE`; no magic literals
- `client/src/utils/coordinates.js` — pure math, no literals
- `server/src/services/roomService.js` — checked; no magic error strings
- `server/src/utils/logger.js` — structured logging, no shared-constant literals
- `e2e/` test files — no literals that reference shared constants

---

## 8. Risk Assessment

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Existing tests break due to hook extraction | Low | Hook interfaces preserve existing return values and callbacks |
| `ROOM_ID_PATTERN` regex derivation introduces subtle mismatch | Low | Pattern is deterministic from the same alphabet string; unit test covers all valid/invalid cases |
| `RoomPage` reconnect move to `useRoom` causes double event subscription | Low | `useRoom`'s existing `ROOM_ERROR` handler merges cleanly; test covers both initial join and reconnect paths |
| `CONNECTION_STATUS` string values changed (case, whitespace) | None | Values match existing live literals exactly |
