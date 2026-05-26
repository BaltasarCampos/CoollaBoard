import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import {
  createRoom,
  getRoom,
  addOperation,
  removeUserFromRoom,
  deleteRoom,
  pushToUndoStack,
  clearRedoStack,
  resolveUndo,
  resolveRedo,
  getUndoRedoState,
  clearUserHistory,
} from '../../src/services/roomService.js';
import {
  ROOM_ID_LENGTH,
  ROOM_ID_ALPHABET,
  ROOM_GRACE_PERIOD_MS,
  OP_TYPE,
  UNDO_HISTORY_DEPTH,
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

  // ── Undo / Redo history functions ───────────────────────────────────────────

  describe('pushToUndoStack()', () => {
    it('pushes an entry onto the user undo stack', () => {
      const room = createRoom();
      const entry = { operationId: 'op-1', type: OP_TYPE.DRAW, userId: 'u1', points: [], timestamp: 1 };
      pushToUndoStack(room.roomId, 'u1', entry);
      const stack = room.userUndoStacks.get('u1');
      expect(stack).toHaveLength(1);
      expect(stack[0].operationId).toBe('op-1');
    });

    it(`caps the stack at ${UNDO_HISTORY_DEPTH} — oldest entry is discarded`, () => {
      const room = createRoom();
      for (let i = 0; i < UNDO_HISTORY_DEPTH + 2; i++) {
        pushToUndoStack(room.roomId, 'u1', { operationId: `op-${i}`, type: OP_TYPE.DRAW, userId: 'u1', points: [], timestamp: i });
      }
      const stack = room.userUndoStacks.get('u1');
      expect(stack).toHaveLength(UNDO_HISTORY_DEPTH);
      // op-0 and op-1 should have been dropped
      expect(stack[0].operationId).toBe('op-2');
    });
  });

  describe('clearRedoStack()', () => {
    it('empties the redo stack for the user', () => {
      const room = createRoom();
      // Manually seed a redo stack
      room.userRedoStacks = room.userRedoStacks ?? new Map();
      room.userRedoStacks.set('u1', [{ operationId: 'r1', type: OP_TYPE.DRAW, userId: 'u1', points: [], timestamp: 1 }]);
      clearRedoStack(room.roomId, 'u1');
      expect(room.userRedoStacks.get('u1')).toHaveLength(0);
    });

    it('is a no-op when redo stack is already empty', () => {
      const room = createRoom();
      expect(() => clearRedoStack(room.roomId, 'u1')).not.toThrow();
    });
  });

  describe('resolveUndo() — personal stroke path', () => {
    it('pops the latest entry from undo stack and removes from room.operations', () => {
      const room = createRoom();
      const fullOp = addOperation(room.roomId, { operationId: 'op-1', type: OP_TYPE.DRAW, userId: 'u1', points: [{ x: 0, y: 0 }, { x: 1, y: 1 }] });
      pushToUndoStack(room.roomId, 'u1', { ...fullOp, timestamp: fullOp.timestamp });

      const result = resolveUndo(room.roomId, 'u1');

      expect(result).not.toBeNull();
      expect(result.operationId).toBe('op-1');
      expect(result.type).toBe(OP_TYPE.DRAW);
      expect(room.operations).toHaveLength(0);
    });

    it('moves the popped entry to the redo stack (DRAW/ERASE only)', () => {
      const room = createRoom();
      const fullOp = addOperation(room.roomId, { operationId: 'op-2', type: OP_TYPE.DRAW, userId: 'u1', points: [{ x: 0, y: 0 }, { x: 1, y: 1 }] });
      pushToUndoStack(room.roomId, 'u1', { ...fullOp, timestamp: fullOp.timestamp });

      resolveUndo(room.roomId, 'u1');

      const redoStack = room.userRedoStacks.get('u1') ?? [];
      expect(redoStack).toHaveLength(1);
      expect(redoStack[0].operationId).toBe('op-2');
    });

    it('returns null when undo stack is empty and no latestClearEntry', () => {
      const room = createRoom();
      expect(resolveUndo(room.roomId, 'u1')).toBeNull();
    });

    it('silently rejects ownership: does not undo a foreign user stroke', () => {
      const room = createRoom();
      const fullOp = addOperation(room.roomId, { operationId: 'op-3', type: OP_TYPE.DRAW, userId: 'u2', points: [{ x: 0, y: 0 }, { x: 1, y: 1 }] });
      // Push onto u2's stack, but call as u1
      pushToUndoStack(room.roomId, 'u2', { ...fullOp, timestamp: fullOp.timestamp });
      // u1 has no stack — should return null
      expect(resolveUndo(room.roomId, 'u1')).toBeNull();
    });
  });

  describe('resolveUndo() — clear canvas path', () => {
    it('undoes the latestClearEntry for any user and sets latestClearEntry to null', () => {
      const room = createRoom();
      const clearOp = addOperation(room.roomId, { operationId: 'clear-1', type: OP_TYPE.CLEAR, userId: 'u1', points: [] });
      room.latestClearEntry = { operationId: 'clear-1', timestamp: clearOp.timestamp };

      const result = resolveUndo(room.roomId, 'u2'); // different user undoes the clear

      expect(result).not.toBeNull();
      expect(result.type).toBe(OP_TYPE.CLEAR);
      expect(result.operationId).toBe('clear-1');
      expect(room.latestClearEntry).toBeNull();
      expect(room.operations).toHaveLength(0);
    });

    it('does NOT add a CLEAR entry to the redo stack', () => {
      const room = createRoom();
      const clearOp = addOperation(room.roomId, { operationId: 'clear-2', type: OP_TYPE.CLEAR, userId: 'u1', points: [] });
      room.latestClearEntry = { operationId: 'clear-2', timestamp: clearOp.timestamp };

      resolveUndo(room.roomId, 'u1');

      const redoStack = room.userRedoStacks?.get('u1') ?? [];
      expect(redoStack).toHaveLength(0);
    });
  });

  describe('resolveRedo()', () => {
    it('pops from redo stack, re-inserts into room.operations, pushes back to undo stack', () => {
      const room = createRoom();
      // Seed redo stack directly
      const entry = { operationId: 'op-r1', type: OP_TYPE.DRAW, userId: 'u1', points: [{ x: 0, y: 0 }, { x: 1, y: 1 }], sequenceNumber: 1, timestamp: 100, color: '#000', brushSize: 4 };
      room.userRedoStacks.set('u1', [entry]);

      const result = resolveRedo(room.roomId, 'u1');

      expect(result).not.toBeNull();
      expect(result.operation.operationId).toBe('op-r1');
      expect(room.operations).toHaveLength(1);
      const undoStack = room.userUndoStacks.get('u1') ?? [];
      expect(undoStack).toHaveLength(1);
    });

    it('returns null when redo stack is empty', () => {
      const room = createRoom();
      expect(resolveRedo(room.roomId, 'u1')).toBeNull();
    });
  });

  describe('getUndoRedoState()', () => {
    it('returns canUndo=false, canRedo=false for a fresh user', () => {
      const room = createRoom();
      expect(getUndoRedoState(room.roomId, 'u1')).toEqual({ canUndo: false, canRedo: false });
    });

    it('returns canUndo=true after pushing to undo stack', () => {
      const room = createRoom();
      pushToUndoStack(room.roomId, 'u1', { operationId: 'op-1', type: OP_TYPE.DRAW, userId: 'u1', points: [], timestamp: 1 });
      expect(getUndoRedoState(room.roomId, 'u1').canUndo).toBe(true);
    });

    it('returns canUndo=true when latestClearEntry is set (regardless of personal stack)', () => {
      const room = createRoom();
      room.latestClearEntry = { operationId: 'c1', timestamp: 1 };
      expect(getUndoRedoState(room.roomId, 'u1').canUndo).toBe(true);
    });

    it('returns canRedo=true when redo stack is non-empty', () => {
      const room = createRoom();
      room.userRedoStacks.set('u1', [{ operationId: 'r1', type: OP_TYPE.DRAW, userId: 'u1', points: [], timestamp: 1 }]);
      expect(getUndoRedoState(room.roomId, 'u1').canRedo).toBe(true);
    });
  });

  describe('clearUserHistory()', () => {
    it('deletes both undo and redo stacks for the user', () => {
      const room = createRoom();
      pushToUndoStack(room.roomId, 'u1', { operationId: 'op-1', type: OP_TYPE.DRAW, userId: 'u1', points: [], timestamp: 1 });
      room.userRedoStacks.set('u1', [{ operationId: 'r1', type: OP_TYPE.DRAW, userId: 'u1', points: [], timestamp: 1 }]);

      clearUserHistory(room.roomId, 'u1');

      expect(room.userUndoStacks.has('u1')).toBe(false);
      expect(room.userRedoStacks.has('u1')).toBe(false);
    });

    it('is a no-op for a user with no history', () => {
      const room = createRoom();
      expect(() => clearUserHistory(room.roomId, 'u99')).not.toThrow();
    });
  });
});
