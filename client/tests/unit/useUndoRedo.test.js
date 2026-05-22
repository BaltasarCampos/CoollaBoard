import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Mock socket.js
vi.mock('../../src/services/socket.js', () => ({
  getSocket: vi.fn(() => ({ on: vi.fn(), off: vi.fn() })),
  emitUndoRequest: vi.fn(),
  emitRedoRequest: vi.fn(),
}));

import * as socketService from '../../src/services/socket.js';
import { useUndoRedo } from '../../src/hooks/useUndoRedo.js';
import { SERVER_EVENTS, UNDO_CONFIRM_TIMEOUT_MS } from 'shared/constants.js';

describe('useUndoRedo hook', () => {
  let mockSocket;
  let socketListeners;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    socketListeners = new Map();
    mockSocket = {
      on: vi.fn((event, cb) => socketListeners.set(event, cb)),
      off: vi.fn(),
    };
    socketService.getSocket.mockReturnValue(mockSocket);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('initialises with canUndo=false and canRedo=false', () => {
    const removeOperation = vi.fn();
    const addOperation = vi.fn();
    const { result } = renderHook(() => useUndoRedo({ removeOperation, addOperation }));

    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });

  it('updates canUndo from undo:state events', () => {
    const removeOperation = vi.fn();
    const addOperation = vi.fn();
    const { result } = renderHook(() => useUndoRedo({ removeOperation, addOperation }));

    act(() => {
      const stateHandler = socketListeners.get(SERVER_EVENTS.UNDO_STATE);
      stateHandler({ canUndo: true, canRedo: false });
    });

    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(false);
  });

  it('updates canRedo from undo:state events', () => {
    const removeOperation = vi.fn();
    const addOperation = vi.fn();
    const { result } = renderHook(() => useUndoRedo({ removeOperation, addOperation }));

    act(() => {
      const stateHandler = socketListeners.get(SERVER_EVENTS.UNDO_STATE);
      stateHandler({ canUndo: false, canRedo: true });
    });

    expect(result.current.canRedo).toBe(true);
  });

  it('requestUndo() emits EVENTS.UNDO_REQUEST via emitUndoRequest', () => {
    const removeOperation = vi.fn();
    const addOperation = vi.fn();
    const { result } = renderHook(() => useUndoRedo({ removeOperation, addOperation }));

    act(() => {
      result.current.requestUndo();
    });

    expect(socketService.emitUndoRequest).toHaveBeenCalledTimes(1);
  });

  it('undo:broadcast calls removeOperation with the operationId', () => {
    const removeOperation = vi.fn();
    const addOperation = vi.fn();
    renderHook(() => useUndoRedo({ removeOperation, addOperation }));

    act(() => {
      const broadcastHandler = socketListeners.get(SERVER_EVENTS.UNDO_BROADCAST);
      broadcastHandler({ type: 'DRAW', operationId: 'op-test-1', userId: 'other-user' });
    });

    expect(removeOperation).toHaveBeenCalledWith('op-test-1');
  });

  it('pending guard prevents double-emit of requestUndo', () => {
    const removeOperation = vi.fn();
    const addOperation = vi.fn();
    const { result } = renderHook(() => useUndoRedo({ removeOperation, addOperation }));

    act(() => {
      result.current.requestUndo();
      result.current.requestUndo(); // second call should be ignored
    });

    expect(socketService.emitUndoRequest).toHaveBeenCalledTimes(1);
  });

  it('pending guard re-enables after UNDO_CONFIRM_TIMEOUT_MS if no broadcast arrives', () => {
    const removeOperation = vi.fn();
    const addOperation = vi.fn();
    const { result } = renderHook(() => useUndoRedo({ removeOperation, addOperation }));

    act(() => {
      result.current.requestUndo();
    });

    expect(socketService.emitUndoRequest).toHaveBeenCalledTimes(1);

    // Before timeout: second call is blocked
    act(() => {
      result.current.requestUndo();
    });
    expect(socketService.emitUndoRequest).toHaveBeenCalledTimes(1);

    // After timeout: pending resets, another call is allowed
    act(() => {
      vi.advanceTimersByTime(UNDO_CONFIRM_TIMEOUT_MS + 100);
    });

    act(() => {
      result.current.requestUndo();
    });
    expect(socketService.emitUndoRequest).toHaveBeenCalledTimes(2);
  });
});

// ── US3: redo-specific tests ─────────────────────────────────────────────────

describe('useUndoRedo hook — redo (US3)', () => {
  let mockSocket;
  let socketListeners;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    socketListeners = new Map();
    mockSocket = {
      on: vi.fn((event, cb) => socketListeners.set(event, cb)),
      off: vi.fn(),
    };
    socketService.getSocket.mockReturnValue(mockSocket);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('requestRedo() emits EVENTS.REDO_REQUEST via emitRedoRequest', () => {
    const removeOperation = vi.fn();
    const addOperation = vi.fn();
    const { result } = renderHook(() => useUndoRedo({ removeOperation, addOperation }));

    act(() => {
      result.current.requestRedo();
    });

    expect(socketService.emitRedoRequest).toHaveBeenCalledTimes(1);
  });

  it('redo:broadcast calls addOperation with the full operation payload', () => {
    const removeOperation = vi.fn();
    const addOperation = vi.fn();
    renderHook(() => useUndoRedo({ removeOperation, addOperation }));

    const op = { operationId: 'op-redo-1', type: 'DRAW', points: [], userId: 'u1', sequenceNumber: 1, timestamp: 100 };
    act(() => {
      const broadcastHandler = socketListeners.get(SERVER_EVENTS.REDO_BROADCAST);
      broadcastHandler({ operation: op, userId: 'u1' });
    });

    expect(addOperation).toHaveBeenCalledWith(op);
  });

  it('pending guard prevents double-emit of requestRedo', () => {
    const removeOperation = vi.fn();
    const addOperation = vi.fn();
    const { result } = renderHook(() => useUndoRedo({ removeOperation, addOperation }));

    act(() => {
      result.current.requestRedo();
      result.current.requestRedo();
    });

    expect(socketService.emitRedoRequest).toHaveBeenCalledTimes(1);
  });
});

// ── Polish: keyboard shortcuts ───────────────────────────────────────────────

describe('useUndoRedo hook — keyboard shortcuts (Polish)', () => {
  let mockSocket;
  let socketListeners;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    socketListeners = new Map();
    mockSocket = {
      on: vi.fn((event, cb) => socketListeners.set(event, cb)),
      off: vi.fn(),
    };
    socketService.getSocket.mockReturnValue(mockSocket);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('Ctrl+Z calls requestUndo (emits UNDO_REQUEST)', () => {
    const removeOperation = vi.fn();
    const addOperation = vi.fn();
    renderHook(() => useUndoRedo({ removeOperation, addOperation }));

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true }));
    });

    expect(socketService.emitUndoRequest).toHaveBeenCalledTimes(1);
  });

  it('Cmd+Z calls requestUndo (emits UNDO_REQUEST)', () => {
    const removeOperation = vi.fn();
    const addOperation = vi.fn();
    renderHook(() => useUndoRedo({ removeOperation, addOperation }));

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', metaKey: true, bubbles: true }));
    });

    expect(socketService.emitUndoRequest).toHaveBeenCalledTimes(1);
  });

  it('Ctrl+Y calls requestRedo (emits REDO_REQUEST)', () => {
    const removeOperation = vi.fn();
    const addOperation = vi.fn();
    renderHook(() => useUndoRedo({ removeOperation, addOperation }));

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'y', ctrlKey: true, bubbles: true }));
    });

    expect(socketService.emitRedoRequest).toHaveBeenCalledTimes(1);
  });

  it('Cmd+Y calls requestRedo (emits REDO_REQUEST)', () => {
    const removeOperation = vi.fn();
    const addOperation = vi.fn();
    renderHook(() => useUndoRedo({ removeOperation, addOperation }));

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'y', metaKey: true, bubbles: true }));
    });

    expect(socketService.emitRedoRequest).toHaveBeenCalledTimes(1);
  });

  it('Ctrl+Shift+Z calls requestRedo', () => {
    const removeOperation = vi.fn();
    const addOperation = vi.fn();
    renderHook(() => useUndoRedo({ removeOperation, addOperation }));

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, shiftKey: true, bubbles: true }));
    });

    expect(socketService.emitRedoRequest).toHaveBeenCalledTimes(1);
  });

  it('Cmd+Shift+Z calls requestRedo', () => {
    const removeOperation = vi.fn();
    const addOperation = vi.fn();
    renderHook(() => useUndoRedo({ removeOperation, addOperation }));

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', metaKey: true, shiftKey: true, bubbles: true }));
    });

    expect(socketService.emitRedoRequest).toHaveBeenCalledTimes(1);
  });

  it('keyboard listener is removed on hook unmount', () => {
    const removeOperation = vi.fn();
    const addOperation = vi.fn();
    const addEventSpy = vi.spyOn(document, 'addEventListener');
    const removeEventSpy = vi.spyOn(document, 'removeEventListener');

    const { unmount } = renderHook(() => useUndoRedo({ removeOperation, addOperation }));
    unmount();

    expect(removeEventSpy).toHaveBeenCalledWith('keydown', expect.any(Function));

    addEventSpy.mockRestore();
    removeEventSpy.mockRestore();
  });
});
