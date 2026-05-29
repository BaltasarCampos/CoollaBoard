import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Mock the socket.js service
vi.mock('../../src/services/socket.js', () => ({
  createRoom: vi.fn(),
  joinRoom: vi.fn(),
  onConnectionStatus: vi.fn(),
  offConnectionStatus: vi.fn(),
  getSocket: vi.fn(() => ({ on: vi.fn(), off: vi.fn() })),
}));

import * as socketService from '../../src/services/socket.js';
import { useRoom } from '../../src/hooks/useRoom.js';

describe('useRoom hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    socketService.getSocket.mockReturnValue({ on: vi.fn(), off: vi.fn() });
  });

  it('calls createRoom() when no roomId prop is provided', async () => {
    socketService.createRoom.mockResolvedValue({ roomId: 'NEW123', userId: 'user-1' });

    const { result } = renderHook(() => useRoom({ roomId: null, onRoomJoined: vi.fn(), onLeaveRoom: vi.fn() }));

    await act(async () => {});
    expect(socketService.createRoom).toHaveBeenCalledTimes(1);
  });

  it('stores roomId and userId in state after createRoom resolves', async () => {
    socketService.createRoom.mockResolvedValue({ roomId: 'NEW123', userId: 'user-1' });
    const onRoomJoined = vi.fn();

    renderHook(() => useRoom({ roomId: null, onRoomJoined, onLeaveRoom: vi.fn() }));
    await act(async () => {});

    expect(onRoomJoined).toHaveBeenCalledWith({ roomId: 'NEW123', userId: 'user-1' });
  });

  it('calls joinRoom() when a roomId prop is provided', async () => {
    socketService.joinRoom.mockResolvedValue({ operations: [] });

    renderHook(() => useRoom({ roomId: 'EXIST1', userId: null, onRoomJoined: vi.fn(), onLeaveRoom: vi.fn() }));
    await act(async () => {});

    expect(socketService.joinRoom).toHaveBeenCalledWith('EXIST1', undefined, undefined);
  });

  it('cleans up socket listeners on unmount', async () => {
    socketService.createRoom.mockResolvedValue({ roomId: 'NEW123', userId: 'user-1' });
    const offMock = vi.fn();
    socketService.getSocket.mockReturnValue({ on: vi.fn(), off: offMock });

    const { unmount } = renderHook(() => useRoom({ roomId: null, onRoomJoined: vi.fn(), onLeaveRoom: vi.fn() }));
    await act(async () => {});
    unmount();

    expect(offMock).toHaveBeenCalled();
  });
});
