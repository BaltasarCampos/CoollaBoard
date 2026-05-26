import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

vi.mock('../../src/services/socket.js', () => ({
  getSocket: vi.fn(() => ({ on: vi.fn(), off: vi.fn() })),
  createRoom: vi.fn(),
  joinRoom: vi.fn(),
  onConnectionStatus: vi.fn(),
  offConnectionStatus: vi.fn(),
}));

import * as socketService from '../../src/services/socket.js';
import { useCanvas } from '../../src/hooks/useCanvas.js';
import { OP_TYPE } from 'shared/constants.js';

describe('useCanvas hook', () => {
  let mockSocket;
  let socketListeners;

  beforeEach(() => {
    vi.clearAllMocks();
    socketListeners = new Map();
    mockSocket = {
      on: vi.fn((event, cb) => socketListeners.set(event, cb)),
      off: vi.fn(),
    };
    socketService.getSocket.mockReturnValue(mockSocket);
  });

  it('addOperation appends to the operations array', () => {
    const { result } = renderHook(() => useCanvas());
    const op = { operationId: 'op1', sequenceNumber: 1, type: OP_TYPE.DRAW, points: [{ x: 0, y: 0 }, { x: 1, y: 1 }], userId: 'u1', timestamp: Date.now() };

    act(() => result.current.addOperation(op));

    expect(result.current.operations).toHaveLength(1);
    expect(result.current.operations[0].operationId).toBe('op1');
  });

  it('convergence discards all ops at or before the last CLEAR index', () => {
    const { result } = renderHook(() => useCanvas());

    act(() => {
      result.current.addOperation({ operationId: 'op1', sequenceNumber: 1, type: OP_TYPE.DRAW, points: [{ x: 0, y: 0 }, { x: 1, y: 1 }], userId: 'u', timestamp: 0 });
      result.current.addOperation({ operationId: 'op2', sequenceNumber: 2, type: OP_TYPE.CLEAR, points: [], userId: 'u', timestamp: 0 });
      result.current.addOperation({ operationId: 'op3', sequenceNumber: 3, type: OP_TYPE.DRAW, points: [{ x: 5, y: 5 }, { x: 6, y: 6 }], userId: 'u', timestamp: 0 });
    });

    const visible = result.current.getVisibleOperations();
    // Only op3 should be visible (after the CLEAR at seq 2)
    expect(visible.every((op) => op.sequenceNumber > 2)).toBe(true);
    expect(visible.some((op) => op.operationId === 'op3')).toBe(true);
  });

  it('DRAW ops are replayed in sequenceNumber order', () => {
    const { result } = renderHook(() => useCanvas());

    act(() => {
      // Add out of order
      result.current.addOperation({ operationId: 'op2', sequenceNumber: 2, type: OP_TYPE.DRAW, points: [{ x: 2, y: 2 }, { x: 3, y: 3 }], userId: 'u', timestamp: 0 });
      result.current.addOperation({ operationId: 'op1', sequenceNumber: 1, type: OP_TYPE.DRAW, points: [{ x: 0, y: 0 }, { x: 1, y: 1 }], userId: 'u', timestamp: 0 });
    });

    const visible = result.current.getVisibleOperations();
    expect(visible[0].sequenceNumber).toBe(1);
    expect(visible[1].sequenceNumber).toBe(2);
  });

  it('draw:broadcast listener appends remote ops', () => {
    const { result } = renderHook(() => useCanvas());

    const remoteOp = { operationId: 'remote-1', sequenceNumber: 1, type: OP_TYPE.DRAW, points: [{ x: 0, y: 0 }, { x: 1, y: 1 }], userId: 'remote-user', timestamp: Date.now() };

    act(() => {
      const broadcastHandler = socketListeners.get('draw:broadcast');
      expect(broadcastHandler).toBeDefined();
      broadcastHandler(remoteOp);
    });

    expect(result.current.operations.some((op) => op.operationId === 'remote-1')).toBe(true);
  });

  it('ERASE op appears in getVisibleOperations (not filtered out)', () => {
    const { result } = renderHook(() => useCanvas());

    act(() => {
      result.current.addOperation({ operationId: 'erase-1', sequenceNumber: 1, type: OP_TYPE.ERASE, points: [{ x: 100, y: 100 }], userId: 'u', timestamp: 0 });
    });

    const visible = result.current.getVisibleOperations();
    expect(visible.some((op) => op.type === OP_TYPE.ERASE)).toBe(true);
  });

  it('ERASE ops are not treated as CLEAR — they do not truncate history', () => {
    const { result } = renderHook(() => useCanvas());

    act(() => {
      result.current.addOperation({ operationId: 'draw-1', sequenceNumber: 1, type: OP_TYPE.DRAW, points: [{ x: 0, y: 0 }, { x: 1, y: 1 }], userId: 'u', timestamp: 0 });
      result.current.addOperation({ operationId: 'erase-1', sequenceNumber: 2, type: OP_TYPE.ERASE, points: [{ x: 5, y: 5 }], userId: 'u', timestamp: 0 });
    });

    const visible = result.current.getVisibleOperations();
    // Both draw and erase should be visible (ERASE doesn't clear history)
    expect(visible).toHaveLength(2);
  });

  describe('removeOperation()', () => {
    it('removes an operation by operationId', () => {
      const { result } = renderHook(() => useCanvas());

      act(() => {
        result.current.addOperation({ operationId: 'rem-1', sequenceNumber: 1, type: OP_TYPE.DRAW, points: [{ x: 0, y: 0 }, { x: 1, y: 1 }], userId: 'u', timestamp: 0 });
        result.current.addOperation({ operationId: 'rem-2', sequenceNumber: 2, type: OP_TYPE.DRAW, points: [{ x: 2, y: 2 }, { x: 3, y: 3 }], userId: 'u', timestamp: 0 });
      });

      act(() => {
        result.current.removeOperation('rem-1');
      });

      expect(result.current.operations).toHaveLength(1);
      expect(result.current.operations[0].operationId).toBe('rem-2');
    });

    it('is a no-op when the operationId is not present (idempotent)', () => {
      const { result } = renderHook(() => useCanvas());

      act(() => {
        result.current.addOperation({ operationId: 'keep-1', sequenceNumber: 1, type: OP_TYPE.DRAW, points: [{ x: 0, y: 0 }, { x: 1, y: 1 }], userId: 'u', timestamp: 0 });
      });

      act(() => {
        result.current.removeOperation('nonexistent-id');
      });

      expect(result.current.operations).toHaveLength(1);
    });
  });
});
