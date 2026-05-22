import {
  ROOM_ID_LENGTH,
  ROOM_ID_ALPHABET,
  ROOM_GRACE_PERIOD_MS,
  OP_TYPE,
  UNDO_HISTORY_DEPTH,
} from 'shared/constants.js';

/** @type {Map<string, Room>} */
const rooms = new Map();

/** @type {Map<string, Set<string>>} — per-room seen operationId sets */
const seenOps = new Map();

function generateRoomId() {
  let id = '';
  const len = ROOM_ID_ALPHABET.length;
  for (let i = 0; i < ROOM_ID_LENGTH; i++) {
    // Use crypto.randomUUID entropy to pick characters
    // crypto.randomUUID() returns a hex-based UUID; we use each nibble
    const rand = Math.floor(Math.random() * len);
    id += ROOM_ID_ALPHABET[rand];
  }
  return id;
}

export function createRoom() {
  let roomId;
  do {
    roomId = generateRoomId();
  } while (rooms.has(roomId));

  const room = {
    roomId,
    operations: [],
    nextSequence: 1,
    connectedUsers: new Set(),
    gracePeriodTimer: null,
    createdAt: new Date(),
    lastActivityAt: new Date(),
    userUndoStacks: new Map(),
    userRedoStacks: new Map(),
    latestClearEntry: null,
  };

  rooms.set(roomId, room);
  seenOps.set(roomId, new Set());
  return room;
}

export function getRoom(roomId) {
  return rooms.get(roomId) ?? null;
}

export function deleteRoom(roomId) {
  rooms.delete(roomId);
  seenOps.delete(roomId);
}

export function addUserToRoom(roomId, userId) {
  const room = getRoom(roomId);
  if (!room) return false;

  // Cancel grace period if running
  if (room.gracePeriodTimer !== null) {
    clearTimeout(room.gracePeriodTimer);
    room.gracePeriodTimer = null;
  }

  room.connectedUsers.add(userId);
  room.lastActivityAt = new Date();
  return true;
}

export function removeUserFromRoom(roomId, userId) {
  const room = getRoom(roomId);
  if (!room) return;

  room.connectedUsers.delete(userId);
  room.lastActivityAt = new Date();

  if (room.connectedUsers.size === 0) {
    room.gracePeriodTimer = setTimeout(() => {
      deleteRoom(roomId);
    }, ROOM_GRACE_PERIOD_MS);
  }
}

export function addOperation(roomId, op) {
  const room = getRoom(roomId);
  if (!room) return null;

  const seen = seenOps.get(roomId);
  if (seen.has(op.operationId)) return null; // duplicate

  seen.add(op.operationId);

  const fullOp = {
    operationId: op.operationId,
    sequenceNumber: room.nextSequence++,
    type: op.type,
    userId: op.userId,
    points: op.points ?? [],
    color: op.color,
    brushSize: op.brushSize,
    timestamp: Date.now(),
  };

  room.operations.push(fullOp);
  room.lastActivityAt = new Date();
  return fullOp;
}

// ── Undo / Redo history ──────────────────────────────────────────────────────

export function pushToUndoStack(roomId, userId, entry) {
  const room = getRoom(roomId);
  if (!room) return;

  const stack = room.userUndoStacks.get(userId) ?? [];
  stack.push(entry);
  if (stack.length > UNDO_HISTORY_DEPTH) {
    stack.shift(); // discard oldest
  }
  room.userUndoStacks.set(userId, stack);
}

export function clearRedoStack(roomId, userId) {
  const room = getRoom(roomId);
  if (!room) return;
  room.userRedoStacks.set(userId, []);
}

export function resolveUndo(roomId, userId) {
  const room = getRoom(roomId);
  if (!room) return null;

  const personalStack = room.userUndoStacks.get(userId) ?? [];
  const clearEntry = room.latestClearEntry;

  const personalTop = personalStack.length > 0 ? personalStack[personalStack.length - 1] : null;

  if (!personalTop && !clearEntry) return null;

  let target;
  if (personalTop && !clearEntry) {
    target = { source: 'personal', entry: personalTop };
  } else if (!personalTop && clearEntry) {
    target = { source: 'clear', operationId: clearEntry.operationId };
  } else if (personalTop.timestamp >= clearEntry.timestamp) {
    target = { source: 'personal', entry: personalTop };
  } else {
    target = { source: 'clear', operationId: clearEntry.operationId };
  }

  if (target.source === 'personal') {
    personalStack.pop();
    room.userUndoStacks.set(userId, personalStack);

    // Add to redo only for DRAW/ERASE (not CLEAR)
    if (target.entry.type !== OP_TYPE.CLEAR) {
      const redoStack = room.userRedoStacks.get(userId) ?? [];
      redoStack.push(target.entry);
      room.userRedoStacks.set(userId, redoStack);
    }

    room.operations = room.operations.filter((o) => o.operationId !== target.entry.operationId);
    seenOps.get(roomId)?.delete(target.entry.operationId);

    // If this personal op IS the latest clear, consume the room-level reference too
    if (target.entry.type === OP_TYPE.CLEAR && clearEntry?.operationId === target.entry.operationId) {
      room.latestClearEntry = null;
    }

    return { type: target.entry.type, operationId: target.entry.operationId, userId };
  } else {
    // Clear undo by any participant
    const clearOpId = target.operationId;

    room.latestClearEntry = null;
    room.operations = room.operations.filter((o) => o.operationId !== clearOpId);
    seenOps.get(roomId)?.delete(clearOpId);

    // Clean from originating user's undo stack (if present)
    for (const [, stack] of room.userUndoStacks) {
      const idx = stack.findIndex((o) => o.operationId === clearOpId);
      if (idx !== -1) { stack.splice(idx, 1); break; }
    }

    return { type: OP_TYPE.CLEAR, operationId: clearOpId, userId };
  }
}

export function resolveRedo(roomId, userId) {
  const room = getRoom(roomId);
  if (!room) return null;

  const redoStack = room.userRedoStacks.get(userId) ?? [];
  if (redoStack.length === 0) return null;

  const entry = redoStack.pop();
  room.userRedoStacks.set(userId, redoStack);

  const undoStack = room.userUndoStacks.get(userId) ?? [];
  undoStack.push(entry);
  room.userUndoStacks.set(userId, undoStack);

  room.operations.push(entry);
  room.operations.sort((a, b) => a.sequenceNumber - b.sequenceNumber);
  seenOps.get(roomId)?.add(entry.operationId);

  return { operation: entry, userId };
}

export function getUndoRedoState(roomId, userId) {
  const room = getRoom(roomId);
  if (!room) return { canUndo: false, canRedo: false };

  const undoStack = room.userUndoStacks.get(userId) ?? [];
  const redoStack = room.userRedoStacks.get(userId) ?? [];

  const canUndo = undoStack.length > 0 || room.latestClearEntry !== null;
  const canRedo = redoStack.length > 0;

  return { canUndo, canRedo };
}

export function clearUserHistory(roomId, userId) {
  const room = getRoom(roomId);
  if (!room) return;
  room.userUndoStacks.delete(userId);
  room.userRedoStacks.delete(userId);
}
