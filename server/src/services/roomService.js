import {
  ROOM_ID_LENGTH,
  ROOM_ID_ALPHABET,
  ROOM_GRACE_PERIOD_MS,
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
    timestamp: Date.now(),
  };

  room.operations.push(fullOp);
  room.lastActivityAt = new Date();
  return fullOp;
}
