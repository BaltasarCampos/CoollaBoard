import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import {
  createRoom,
  getRoom,
  addOperation,
  removeUserFromRoom,
  deleteRoom,
} from '../../src/services/roomService.js';
import {
  ROOM_ID_LENGTH,
  ROOM_ID_ALPHABET,
  ROOM_GRACE_PERIOD_MS,
  OP_TYPE,
} from 'shared/constants.js';

describe('roomService', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('createRoom()', () => {
    it('returns a 6-char A–Z0–9 room ID', () => {
      const room = createRoom();
      expect(room.roomId).toMatch(/^[A-Z0-9]{6}$/);
      expect(room.roomId).toHaveLength(ROOM_ID_LENGTH);
    });

    it('stores the room so getRoom can retrieve it', () => {
      const room = createRoom();
      expect(getRoom(room.roomId)).toBe(room);
    });

    it('creates rooms with unique IDs across multiple calls', () => {
      const ids = new Set(Array.from({ length: 20 }, () => createRoom().roomId));
      expect(ids.size).toBe(20);
    });

    it('initialises operations as empty array and nextSequence as 1', () => {
      const room = createRoom();
      expect(room.operations).toEqual([]);
      expect(room.nextSequence).toBe(1);
    });
  });

  describe('getRoom()', () => {
    it('returns null for an unknown roomId', () => {
      expect(getRoom('UNKNWN')).toBeNull();
    });

    it('returns the correct room by roomId', () => {
      const room = createRoom();
      expect(getRoom(room.roomId)).toBe(room);
    });
  });

  describe('addOperation()', () => {
    it('appends a new operation to room.operations', () => {
      const room = createRoom();
      const op = {
        operationId: 'op-1',
        type: OP_TYPE.DRAW,
        userId: 'user-1',
        points: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
      };
      const result = addOperation(room.roomId, op);
      expect(result).not.toBeNull();
      expect(room.operations).toHaveLength(1);
      expect(room.operations[0].operationId).toBe('op-1');
    });

    it('assigns a monotonically increasing sequenceNumber', () => {
      const room = createRoom();
      const op1 = addOperation(room.roomId, { operationId: 'op-1', type: OP_TYPE.DRAW, userId: 'u', points: [{ x: 0, y: 0 }, { x: 1, y: 1 }] });
      const op2 = addOperation(room.roomId, { operationId: 'op-2', type: OP_TYPE.DRAW, userId: 'u', points: [{ x: 0, y: 0 }, { x: 1, y: 1 }] });
      expect(op1.sequenceNumber).toBe(1);
      expect(op2.sequenceNumber).toBe(2);
    });

    it('deduplicates on operationId — second call returns null without appending', () => {
      const room = createRoom();
      const op = { operationId: 'dup-id', type: OP_TYPE.DRAW, userId: 'u', points: [{ x: 0, y: 0 }, { x: 1, y: 1 }] };
      addOperation(room.roomId, op);
      const dup = addOperation(room.roomId, op);
      expect(dup).toBeNull();
      expect(room.operations).toHaveLength(1);
    });

    it('returns null for an unknown roomId', () => {
      expect(addOperation('BADROOM', { operationId: 'x', type: OP_TYPE.DRAW, userId: 'u', points: [] })).toBeNull();
    });
  });

  describe('TTL eviction', () => {
    it('deletes the room after ROOM_GRACE_PERIOD_MS when connectedUsers is 0', () => {
      const room = createRoom();
      // Simulate the grace period being started (called by eventHandlers on last disconnect)
      removeUserFromRoom(room.roomId, 'nobody'); // triggers timer if empty
      jest.advanceTimersByTime(ROOM_GRACE_PERIOD_MS + 1);
      expect(getRoom(room.roomId)).toBeNull();
    });

    it('does NOT delete the room before the grace period elapses', () => {
      const room = createRoom();
      removeUserFromRoom(room.roomId, 'nobody');
      jest.advanceTimersByTime(ROOM_GRACE_PERIOD_MS - 1);
      expect(getRoom(room.roomId)).not.toBeNull();
    });
  });
});
