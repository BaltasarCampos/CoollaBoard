import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// ── Socket mock ──────────────────────────────────────────────────────────────

const socketListeners = new Map();

const mockSocket = {
  on: vi.fn((event, cb) => {
    if (!socketListeners.has(event)) socketListeners.set(event, []);
    socketListeners.get(event).push(cb);
  }),
  off: vi.fn((event, cb) => {
    if (socketListeners.has(event)) {
      socketListeners.set(event, socketListeners.get(event).filter((fn) => fn !== cb));
    }
  }),
};

function emitSocketEvent(event, payload) {
  const handlers = socketListeners.get(event) ?? [];
  for (const h of handlers) h(payload);
}

vi.mock('../../src/services/socket.js', () => ({
  getSocket: vi.fn(() => mockSocket),
  onConnectionStatus: vi.fn(),
  offConnectionStatus: vi.fn(),
}));

import { usePreviewLayer } from '../../src/hooks/usePreviewLayer.js';

beforeEach(() => {
  socketListeners.clear();
  vi.clearAllMocks();
});

// ── Base CRUD (US1) ──────────────────────────────────────────────────────────

describe('usePreviewLayer hook — base CRUD (US1)', () => {
  it('initial previews map is empty', () => {
    const { result } = renderHook(() => usePreviewLayer());
    expect(result.current.previews.size).toBe(0);
  });

  it('setPreview() upserts entry keyed by operationId', () => {
    const { result } = renderHook(() => usePreviewLayer());

    act(() => {
      result.current.setPreview({ operationId: 'op1', type: 'DRAW', points: [{ x: 0, y: 0 }] });
    });

    expect(result.current.previews.size).toBe(1);
    expect(result.current.previews.get('op1')).toMatchObject({ operationId: 'op1', type: 'DRAW' });
  });

  it('calling setPreview() again for the same operationId replaces the previous entry', () => {
    const { result } = renderHook(() => usePreviewLayer());

    act(() => {
      result.current.setPreview({ operationId: 'op1', type: 'DRAW', points: [{ x: 0, y: 0 }] });
    });
    act(() => {
      result.current.setPreview({ operationId: 'op1', type: 'DRAW', points: [{ x: 5, y: 5 }, { x: 10, y: 10 }] });
    });

    expect(result.current.previews.size).toBe(1);
    expect(result.current.previews.get('op1').points).toHaveLength(2);
  });

  it('removePreview() deletes entry by operationId', () => {
    const { result } = renderHook(() => usePreviewLayer());

    act(() => {
      result.current.setPreview({ operationId: 'op1', type: 'DRAW', points: [] });
      result.current.setPreview({ operationId: 'op2', type: 'DRAW', points: [] });
    });
    act(() => {
      result.current.removePreview('op1');
    });

    expect(result.current.previews.size).toBe(1);
    expect(result.current.previews.has('op1')).toBe(false);
    expect(result.current.previews.has('op2')).toBe(true);
  });

  it('clearAllPreviews() empties the entire map', () => {
    const { result } = renderHook(() => usePreviewLayer());

    act(() => {
      result.current.setPreview({ operationId: 'op1', type: 'DRAW', points: [] });
      result.current.setPreview({ operationId: 'op2', type: 'ERASE', points: [] });
    });
    act(() => {
      result.current.clearAllPreviews();
    });

    expect(result.current.previews.size).toBe(0);
  });

  it('hook exposes setPreview, removePreview, clearAllPreviews, and previews', () => {
    const { result } = renderHook(() => usePreviewLayer());
    expect(typeof result.current.setPreview).toBe('function');
    expect(typeof result.current.removePreview).toBe('function');
    expect(typeof result.current.clearAllPreviews).toBe('function');
    expect(result.current.previews).toBeInstanceOf(Map);
  });
});

// ── Socket subscriptions (US2) ───────────────────────────────────────────────

describe('usePreviewLayer hook — socket subscriptions (US2)', () => {
  it('stroke:preview:broadcast calls setPreview() with the full received payload', () => {
    const { result } = renderHook(() => usePreviewLayer());

    act(() => {
      emitSocketEvent('stroke:preview:broadcast', {
        operationId: 'op-remote',
        userId: 'user-b',
        type: 'DRAW',
        points: [{ x: 0, y: 0 }],
        color: '#ef4444',
        brushSize: 4,
      });
    });

    expect(result.current.previews.has('op-remote')).toBe(true);
    expect(result.current.previews.get('op-remote').userId).toBe('user-b');
  });

  it('stroke:cancel:broadcast calls removePreview() with payload.operationId', () => {
    const { result } = renderHook(() => usePreviewLayer());

    act(() => {
      result.current.setPreview({ operationId: 'op-remote', type: 'DRAW', points: [] });
    });
    act(() => {
      emitSocketEvent('stroke:cancel:broadcast', { operationId: 'op-remote', userId: 'user-b' });
    });

    expect(result.current.previews.has('op-remote')).toBe(false);
  });

  it('user:left removes all preview entries whose userId matches', () => {
    const { result } = renderHook(() => usePreviewLayer());

    act(() => {
      result.current.setPreview({ operationId: 'op1', userId: 'user-b', type: 'DRAW', points: [] });
      result.current.setPreview({ operationId: 'op2', userId: 'user-b', type: 'DRAW', points: [] });
      result.current.setPreview({ operationId: 'op3', userId: 'user-c', type: 'DRAW', points: [] });
    });
    act(() => {
      emitSocketEvent('user:left', { userId: 'user-b' });
    });

    expect(result.current.previews.has('op1')).toBe(false);
    expect(result.current.previews.has('op2')).toBe(false);
    expect(result.current.previews.has('op3')).toBe(true);
  });

  it('SC-003: draw:broadcast for an active preview operationId removes it before commit', () => {
    const { result } = renderHook(() => usePreviewLayer());

    act(() => {
      result.current.setPreview({ operationId: 'op-commit', userId: 'user-b', type: 'DRAW', points: [] });
    });

    expect(result.current.previews.has('op-commit')).toBe(true);

    act(() => {
      emitSocketEvent('draw:broadcast', {
        operationId: 'op-commit',
        type: 'DRAW',
        points: [{ x: 0, y: 0 }],
        userId: 'user-b',
        sequenceNumber: 1,
        timestamp: Date.now(),
      });
    });

    // Preview should be removed when the committed broadcast arrives
    expect(result.current.previews.has('op-commit')).toBe(false);
  });

  it('all socket listeners are removed when the hook unmounts', () => {
    const { unmount } = renderHook(() => usePreviewLayer());
    unmount();

    expect(mockSocket.off).toHaveBeenCalledWith('stroke:preview:broadcast', expect.any(Function));
    expect(mockSocket.off).toHaveBeenCalledWith('stroke:cancel:broadcast', expect.any(Function));
    expect(mockSocket.off).toHaveBeenCalledWith('user:left', expect.any(Function));
    expect(mockSocket.off).toHaveBeenCalledWith('draw:broadcast', expect.any(Function));
  });
});
