# Quickstart: Codebase Refactor — Constants & Separation of Concerns

**Feature**: `002-refactor-constants-soc`  
**Branch**: `002-refactor-constants-soc`  
**Date**: 2026-05-14

---

## What This Refactor Does

- Extends `shared/constants.js` with `TOOL_NAMES`, `CONNECTION_STATUS`, and `ERROR_CODES` groups.
- Replaces every bare string/numeric literal in client and server code that duplicates a shared constant.
- Extracts business logic from `HomePage`, `RoomPage`, `Canvas`, and `Toolbar` into dedicated hooks.
- Zero observable behaviour change; all existing tests continue to pass.

---

## Prerequisites

```bash
# From repo root
node --version   # 18+
npm --version    # 9+
```

Ensure the full test suite passes on the current branch before starting:

```bash
cd server  && npm test
cd ..
cd client  && npm test -- --run
cd ..
cd e2e     && npx playwright test   # requires server running on :3001
```

---

## Implementation Order

Follow this exact order to keep the test suite green at every step.

### Step 1 — Extend `shared/constants.js`

Add the three new exports at the bottom of the file (after existing exports):

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

**Verify**: `npm test --run` (client) still passes — no existing code is broken by additions.

---

### Step 2 — Update `services/socket.js`

Replace bare `'Connected'`, `'Reconnecting'`, `'Disconnected'` strings with `CONNECTION_STATUS.*`.

Import addition:
```js
import { EVENTS, SERVER_EVENTS, CONNECTION_STATUS } from 'shared/constants.js';
```

Replacements:
```js
socket.on('connect',           () => emitStatus(CONNECTION_STATUS.CONNECTED));
socket.on('disconnect',        () => emitStatus(CONNECTION_STATUS.DISCONNECTED));
socket.on('reconnect_attempt', () => emitStatus(CONNECTION_STATUS.RECONNECTING));
socket.on('reconnect',         () => emitStatus(CONNECTION_STATUS.CONNECTED));
// ...
cb(socket.connected ? CONNECTION_STATUS.CONNECTED : CONNECTION_STATUS.DISCONNECTED);
```

---

### Step 3 — Update `ConnectionStatus.jsx`

Replace string keys and useState default:

```js
import { CONNECTION_STATUS } from 'shared/constants.js';

const STYLES = {
  [CONNECTION_STATUS.CONNECTED]:    { backgroundColor: '#4caf50', color: '#fff' },
  [CONNECTION_STATUS.RECONNECTING]: { backgroundColor: '#ff9800', color: '#fff' },
  [CONNECTION_STATUS.DISCONNECTED]: { backgroundColor: '#f44336', color: '#fff' },
};

// ...
const [status, setStatus] = useState(CONNECTION_STATUS.DISCONNECTED);
```

---

### Step 4 — Update `server/src/handlers/eventHandlers.js`

Replace inline error code strings:

```js
import { EVENTS, SERVER_EVENTS, OP_TYPE, ERROR_CODES } from 'shared/constants.js';
// ...
ack({ ok: false, error: ERROR_CODES.ROOM_NOT_FOUND, message: `Room ${roomId} does not exist` });
// ...
ack({ ok: false, error: ERROR_CODES.SERVER_ERROR, message: 'Failed to generate room' });
```

---

### Step 5 — Update `hooks/useRoom.js`

Replace inline error code comparison:

```js
import { SERVER_EVENTS, ERROR_CODES } from 'shared/constants.js';
// ...
onLeaveRoomRef.current(err.message === ERROR_CODES.ROOM_NOT_FOUND ? 'room no longer exists' : err.message);
// ...
if (!cancelled && data?.error === ERROR_CODES.ROOM_NOT_FOUND) { ... }
```

---

### Step 6 — Write `useHomePage` tests (TDD — write first)

Create `client/tests/unit/useHomePage.test.js` covering:
- `handleJoin` with too-short input → sets `error`
- `handleJoin` with invalid characters → sets `error`
- `handleJoin` with valid input → calls `joinRoom`, invokes `onRoomJoined`
- `handleCreate` success → calls `createRoom`, invokes `onRoomJoined`
- `handleCreate` failure → sets `error`
- `handleInputChange` clears existing error

Run tests; confirm they **fail** (red phase).

---

### Step 7 — Implement `useHomePage` hook

Create `client/src/hooks/useHomePage.js`:

```js
import { useState } from 'react';
import { ROOM_ID_LENGTH, ROOM_ID_ALPHABET, ERROR_CODES } from 'shared/constants.js';
import { createRoom, joinRoom } from '../services/socket.js';

const charClass = `[${ROOM_ID_ALPHABET}]`;
const ROOM_ID_PATTERN = new RegExp(`^${charClass}{${ROOM_ID_LENGTH}}$`);

export function useHomePage({ onRoomJoined }) {
  const [input,   setInput]   = useState('');
  const [error,   setError]   = useState('');
  const [loading, setLoading] = useState(false);

  function handleInputChange(e) {
    setInput(e.target.value.toUpperCase());
    setError('');
  }

  async function handleCreate() {
    if (loading) return;
    setLoading(true);
    setError('');
    try {
      const result = await createRoom();
      onRoomJoined(result);
    } catch {
      setError('Failed to create room. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleJoin() {
    if (loading) return;
    const roomId = input.trim().toUpperCase();
    if (roomId.length !== ROOM_ID_LENGTH) {
      setError(`Room ID must be exactly ${ROOM_ID_LENGTH} characters.`);
      return;
    }
    if (!ROOM_ID_PATTERN.test(roomId)) {
      setError('Room ID must contain only letters and numbers.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await joinRoom(roomId);
      onRoomJoined({ roomId, ...result });
    } catch (err) {
      if (err.message === ERROR_CODES.ROOM_NOT_FOUND) {
        setError('Room not found. Please check the ID and try again.');
      } else {
        setError('Failed to join room. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  return { input, error, loading, handleInputChange, handleCreate, handleJoin };
}
```

Run tests; confirm they **pass** (green phase).

---

### Step 8 — Refactor `HomePage.jsx`

Remove service imports, inline state, and logic. Use `useHomePage`:

```jsx
import React from 'react';
import { useHomePage } from '../hooks/useHomePage.js';

export default function HomePage({ onRoomJoined, message }) {
  const { input, error, loading, handleInputChange, handleCreate, handleJoin } =
    useHomePage({ onRoomJoined });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '2rem', gap: '1rem' }}>
      <h1>CoollaBoard</h1>
      {message && <p style={{ color: 'orange' }}>{message}</p>}
      <button onClick={handleCreate} disabled={loading}>Create Room</button>
      <hr style={{ width: '100%' }} />
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <input
          type="text"
          placeholder="Room ID"
          value={input}
          onChange={handleInputChange}
          maxLength={6}
          style={{ textTransform: 'uppercase' }}
        />
        <button onClick={handleJoin} disabled={loading}>Join Room</button>
      </div>
      {error && <p style={{ color: 'red' }}>{error}</p>}
    </div>
  );
}
```

---

### Step 9 — Write `useCanvasRenderer` tests (TDD — write first)

Create `client/tests/unit/useCanvasRenderer.test.js`. Use `renderHook` + a mocked canvas context.

Run; confirm **fail** (red).

---

### Step 10 — Implement `useCanvasRenderer` hook

Create `client/src/hooks/useCanvasRenderer.js` extracting `renderDraw`, `renderErase`, RAF loop, and `ResizeObserver` from `Canvas.jsx`.

Run; confirm **pass** (green).

---

### Step 11 — Refactor `Canvas.jsx`

Import and use `useCanvasRenderer`. Remove inline render functions and ResizeObserver effect. Replace `'pen'` / `'eraser'` string literals with `TOOL_NAMES.PEN` / `TOOL_NAMES.ERASER`.

---

### Step 12 — Extend `useRoom` with reconnect logic

Move the `'reconnect'` socket-event handler from `RoomPage.jsx` into `useRoom.js`. Add `addOperations` parameter.

---

### Step 13 — Refactor `RoomPage.jsx`

- Remove `getSocket` and `joinRoom` imports
- Pass `addOperations` to `useRoom`
- Replace `'pen'` initial state with `TOOL_NAMES.PEN`
- Add `onClear` handler that calls `emitClear(crypto.randomUUID())`; pass as prop to `Toolbar`

---

### Step 14 — Refactor `Toolbar.jsx`

- Remove `emitClear` import
- Accept `onClear` prop
- Replace `'pen'` / `'eraser'` literals with `TOOL_NAMES.*`
- Call `onClear()` in `handleConfirmClear`

---

### Step 15 — Verify all tests pass

```bash
cd server  && npm test
cd ..
cd client  && npm test -- --run
```

All tests must pass with zero modifications to existing test files.

---

### Step 16 — Grep-verify no remaining magic literals

```bash
# Should return zero matches
grep -r --include="*.js" --include="*.jsx" \
  -E "'pen'|'eraser'|'Connected'|'Reconnecting'|'Disconnected'|'ROOM_NOT_FOUND'|'SERVER_ERROR'" \
  client/src server/src | grep -v "shared/constants.js"

# Should return zero matches
grep -r --include="*.js" --include="*.jsx" \
  -E "\b6\b|A-Z0-9" \
  client/src | grep -v "shared/constants.js"
```

---

## Running the Full Test Suite

```bash
# Unit + integration (client)
cd client && npm test -- --run

# Unit + integration (server)
cd server && npm test

# E2E (requires both server and client dev server running)
cd server && npm start &
cd client && npm run dev &
cd e2e    && npx playwright test
```
