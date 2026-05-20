# Data Model: Collaborative Undo / Redo

**Feature**: `006-undo-redo`
**Date**: 2026-05-20
**Layer**: Server-side in-memory (per-room); client-side derived state (canUndo / canRedo flags only)

---

## Overview

This feature introduces three new server-side data structures — `UndoStack`, `RedoStack`, and `LatestClearEntry` — all scoped to the existing `room` object in `roomService.js`. The client-side `useUndoRedo` hook holds only two boolean flags (`canUndo`, `canRedo`) derived from server-emitted `undo:state` events. No new persistent storage is introduced; all state is in-memory and cleared on room teardown or user disconnect.

The existing `Operation` entity and `room.operations` array continue unchanged, except that `resolveUndo` removes entries from the array and `resolveRedo` re-inserts them. New joiners always receive the current (post-undo) operation list.

---

## Entity: HistoryEntry

A single reversible action stored in a user's undo or redo stack. Contains enough data to remove and restore the operation on the canvas.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `operationId` | `string` (UUID v4) | ✅ | Unique identifier matching the original `Operation.operationId`. Used to locate and remove the op from `room.operations` on undo, and to key the broadcast. |
| `type` | `'DRAW' \| 'ERASE' \| 'CLEAR'` | ✅ | Operation type. CLEAR entries appear only in the undo stack (never redo, per FR-005). |
| `userId` | `string` (UUID v4) | ✅ | The user who originally performed the action. Server validates this on undo:request (FR-013). |
| `points` | `Array<{ x: number, y: number }>` | for DRAW/ERASE | Full point array of the stroke. Needed to re-add the op on redo (redo:broadcast must carry the full operation). |
| `color` | `string` (CSS hex) | for DRAW | Stroke color. Required for redo re-insertion. |
| `brushSize` | `number` | for DRAW | Brush width in virtual units. Required for redo re-insertion. |
| `sequenceNumber` | `number` | ✅ | Original server-assigned sequence number. Preserved so `room.operations` remains sorted on redo re-insertion. |
| `timestamp` | `number` (epoch ms) | ✅ | Server-assigned commit timestamp. Used when comparing the personal undo stack top against `latestClearEntry` to determine which is more recent. |

**Validation rules**:
- `operationId` must match a known `Operation` in `room.operations` at the time of undo (server verifies before removal).
- `type` must be one of `OP_TYPE.DRAW`, `OP_TYPE.ERASE`, or `OP_TYPE.CLEAR`.
- `userId` must match `sessions.get(socket.id).userId` for DRAW/ERASE undo requests; CLEAR undo is exempt (FR-013).

---

## Data Structure: UndoStack (per user)

An ordered collection of `HistoryEntry` objects representing past actions available for a user to undo, stored most-recent-last (stack top at `array[array.length - 1]`).

```
UndoStack: HistoryEntry[]   (max length: UNDO_HISTORY_DEPTH = 20)
Stored at: room.userUndoStacks.get(userId)
```

**Invariants**:
- Length never exceeds `UNDO_HISTORY_DEPTH`. When a new entry would push it over the limit, the oldest entry (`array[0]`) is silently discarded (FR-009).
- Entries are pushed on every committed DRAW, ERASE, or CLEAR triggered by this user.
- The undo stack is cleared entirely when the user disconnects from the room (`clearUserHistory`).

**Operations**:

| Operation | Trigger | Effect |
|-----------|---------|--------|
| `pushToUndoStack(roomId, userId, entry)` | `draw:stroke` committed; `canvas:clear` committed | Push entry; trim if `length > 20` |
| `resolveUndo(roomId, userId)` → pops stack | `undo:request` received (for personal op) | Pop entry, remove from `room.operations`, push to redo stack |
| `clearUserHistory(roomId, userId)` | User disconnects | Delete stack entirely |

---

## Data Structure: RedoStack (per user)

An ordered collection of undone `HistoryEntry` objects available for redo, most-recently-undone-last.

```
RedoStack: HistoryEntry[]
Stored at: room.userRedoStacks.get(userId)
```

**Invariants**:
- Contains only DRAW and ERASE entries — CLEAR entries are never added (FR-005).
- Emptied entirely when the user commits a new DRAW or ERASE operation (FR-007).
- Emptied entirely on user disconnect.

**Operations**:

| Operation | Trigger | Effect |
|-----------|---------|--------|
| `clearRedoStack(roomId, userId)` | New `draw:stroke` committed | Empty the stack |
| `resolveRedo(roomId, userId)` → pops redo, pushes undo | `redo:request` received | Pop entry, re-insert into `room.operations`, push back to undo stack |
| `clearUserHistory(roomId, userId)` | User disconnects | Delete stack entirely |

---

## Data Structure: LatestClearEntry (per room)

A single nullable reference to the most recent unresolved CLEAR operation in the room. Available for undo by any participant, regardless of who triggered the clear (FR-004).

```
LatestClearEntry: { operationId: string, timestamp: number } | null
Stored at: room.latestClearEntry
```

**Invariants**:
- At most one entry at a time — when a new CLEAR is committed, the previous entry (if any) is replaced. Multiple sequential clears mean only the most recent clear is undoable; earlier CLEARs are already committed/consumed.
- Set to `null` once any user successfully undoes the clear (consumed, FR-005). Cannot be reinstated for that clear.
- Independent of `userUndoStacks` — it is consulted in addition to the user's personal stack when resolving undo.

**Operations**:

| Operation | Trigger | Effect |
|-----------|---------|--------|
| Set (replace if exists) | `canvas:clear` committed | `room.latestClearEntry = { operationId, timestamp }` |
| Consumed (set to null) | Any user's `undo:request` resolves to the clear | `room.latestClearEntry = null`; clean up from originating user's undo stack |

---

## Client-Side State: useUndoRedo Hook

Two boolean flags derived exclusively from server-emitted `undo:state` events; the client does not compute or maintain its own history representation.

| Field | Type | Source | Description |
|-------|------|--------|-------------|
| `canUndo` | `boolean` | `SERVER_EVENTS.UNDO_STATE` | True when the server has at least one item resolvable for this user (personal stack not empty OR `latestClearEntry !== null`). |
| `canRedo` | `boolean` | `SERVER_EVENTS.UNDO_STATE` | True when the server's redo stack for this user is non-empty. |
| `pending` | `boolean` (internal ref) | Local timeout logic | True while awaiting server confirmation of the last undo/redo; prevents double-emit. |

**State transitions**:

```
Initial (join/create room)   → canUndo: depends on server state, canRedo: false
draw:stroke committed        → canUndo: true, canRedo: false
undo:request sent            → pending: true (timer starts)
undo:broadcast received      → pending: false (timer cleared); canUndo/canRedo update from undo:state
redo:request sent            → pending: true (timer starts)
redo:broadcast received      → pending: false; canUndo/canRedo update from undo:state
Timeout (5s, no broadcast)   → pending: false; canUndo/canRedo unchanged (control re-enabled)
User disconnect              → stacks cleared server-side; on reconnect canUndo: false, canRedo: false
```

---

## Server-Side `resolveUndo` Logic (pseudocode)

```
function resolveUndo(roomId, userId):
  room = getRoom(roomId)
  personalStack = room.userUndoStacks.get(userId) ?? []
  clearEntry    = room.latestClearEntry

  personalTop = personalStack.at(-1) ?? null

  if (!personalTop && !clearEntry) return null   // nothing to undo

  // Determine which is more recent
  let target
  if (personalTop && !clearEntry)               target = { source: 'personal', entry: personalTop }
  else if (!personalTop && clearEntry)          target = { source: 'clear', operationId: clearEntry.operationId }
  else if (personalTop.timestamp >= clearEntry.timestamp)
                                                target = { source: 'personal', entry: personalTop }
  else                                          target = { source: 'clear', operationId: clearEntry.operationId }

  if (target.source === 'personal') {
    // Pop from undo stack
    personalStack.pop()
    room.userUndoStacks.set(userId, personalStack)

    // Move to redo stack (only for DRAW/ERASE; CLEAR never enters redo)
    if (target.entry.type !== OP_TYPE.CLEAR) {
      redoStack = room.userRedoStacks.get(userId) ?? []
      redoStack.push(target.entry)
      room.userRedoStacks.set(userId, redoStack)
    }

    // Remove from room.operations
    room.operations = room.operations.filter(o => o.operationId !== target.entry.operationId)
    seenOps.get(roomId).delete(target.entry.operationId)

    // If this personal op IS the latest clear, consume it as well
    if (target.entry.type === OP_TYPE.CLEAR && clearEntry?.operationId === target.entry.operationId) {
      room.latestClearEntry = null
    }

    return { type: target.entry.type, operationId: target.entry.operationId, userId }

  } else {
    // Clear undo by any participant
    const clearOpId = target.operationId

    room.latestClearEntry = null
    room.operations = room.operations.filter(o => o.operationId !== clearOpId)
    seenOps.get(roomId).delete(clearOpId)

    // Clean from originating user's undo stack (if present)
    for (const [uid, stack] of room.userUndoStacks) {
      const idx = stack.findIndex(o => o.operationId === clearOpId)
      if (idx !== -1) { stack.splice(idx, 1); break }
    }

    return { type: OP_TYPE.CLEAR, operationId: clearOpId, userId }
  }
```

---

## Server-Side `resolveRedo` Logic (pseudocode)

```
function resolveRedo(roomId, userId):
  room = getRoom(roomId)
  redoStack = room.userRedoStacks.get(userId) ?? []
  if (redoStack.length === 0) return null

  const entry = redoStack.pop()
  room.userRedoStacks.set(userId, redoStack)

  // Re-push to undo stack
  const undoStack = room.userUndoStacks.get(userId) ?? []
  undoStack.push(entry)
  room.userUndoStacks.set(userId, undoStack)

  // Re-insert into room.operations, sorted by sequenceNumber
  room.operations.push(entry)
  room.operations.sort((a, b) => a.sequenceNumber - b.sequenceNumber)
  seenOps.get(roomId).add(entry.operationId)

  return { operation: entry, userId }
```

---

## New Constants (`shared/constants.js` additions)

```js
// Client → Server
EVENTS.UNDO_REQUEST = 'undo:request'
EVENTS.REDO_REQUEST = 'redo:request'

// Server → Client
SERVER_EVENTS.UNDO_BROADCAST = 'undo:broadcast'
SERVER_EVENTS.REDO_BROADCAST = 'redo:broadcast'
SERVER_EVENTS.UNDO_STATE     = 'undo:state'

// History configuration
UNDO_HISTORY_DEPTH      = 20
UNDO_CONFIRM_TIMEOUT_MS = 5000
```

---

## Relationship to Existing Entities

```
Operation (committed, in room.operations)
  └── operationId: UUID  ←─ referenced by HistoryEntry.operationId
  └── type / points / color / brushSize / sequenceNumber / timestamp
         ↕  (resolveUndo removes; resolveRedo re-inserts)

HistoryEntry (in userUndoStacks / userRedoStacks)
  └── operationId: UUID  ←── same as Operation
  └── full op fields    ←── snapshot needed for redo:broadcast payload

LatestClearEntry (nullable, per room)
  └── operationId: UUID  ←── references the CLEAR Operation in room.operations
```

The `HistoryEntry` stores a snapshot of the full operation fields so that `redo:broadcast` can carry the complete `Operation` payload to re-add it to all clients' local arrays.
