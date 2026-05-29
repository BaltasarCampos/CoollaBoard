import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Mock the socket.js service
vi.mock('../../src/services/socket.js', () => ({
  getSocket: vi.fn(),
}));

import * as socketService from '../../src/services/socket.js';
import { useParticipants } from '../../src/hooks/useParticipants.js';

const makeSocket = (overrides = {}) => ({
  on: vi.fn(),
  off: vi.fn(),
  ...overrides,
});

describe('useParticipants hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── US1: Initial state ───────────────────────────────────────────────────

  it('initialises participants to the provided initialParticipants array', () => {
    const initial = [
      { userId: 'u1', displayName: 'Alice' },
      { userId: 'u2', displayName: 'Bob' },
    ];
    socketService.getSocket.mockReturnValue(makeSocket());

    const { result } = renderHook(() => useParticipants(initial));

    expect(result.current.participants).toEqual(initial);
  });

  it('initialises isLoading to false', () => {
    socketService.getSocket.mockReturnValue(makeSocket());

    const { result } = renderHook(() => useParticipants([]));

    expect(result.current.isLoading).toBe(false);
  });

  it('initialises with empty array when no initialParticipants given', () => {
    socketService.getSocket.mockReturnValue(makeSocket());

    const { result } = renderHook(() => useParticipants([]));

    expect(result.current.participants).toEqual([]);
    expect(result.current.isLoading).toBe(false);
  });

  // ── US2: Real-time updates ───────────────────────────────────────────────

  it('updates participants when participants:updated socket event is received', () => {
    let capturedHandler = null;
    const socket = makeSocket({
      on: vi.fn((event, handler) => {
        if (event === 'participants:updated') capturedHandler = handler;
      }),
    });
    socketService.getSocket.mockReturnValue(socket);

    const { result } = renderHook(() => useParticipants([]));

    const updated = [
      { userId: 'u1', displayName: 'Alice' },
      { userId: 'u3', displayName: 'Charlie' },
    ];

    act(() => {
      capturedHandler({ participants: updated });
    });

    expect(result.current.participants).toEqual(updated);
  });

  it('unsubscribes from participants:updated on unmount', () => {
    const socket = makeSocket();
    socketService.getSocket.mockReturnValue(socket);

    const { unmount } = renderHook(() => useParticipants([]));
    unmount();

    expect(socket.off).toHaveBeenCalledWith('participants:updated', expect.any(Function));
  });
});
