import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

vi.mock('../../src/services/socket.js', () => ({
  createRoom: vi.fn(),
  joinRoom: vi.fn(),
  onConnectionStatus: vi.fn(),
  offConnectionStatus: vi.fn(),
  getSocket: vi.fn(() => ({ on: vi.fn(), off: vi.fn() })),
}));

import * as socketService from '../../src/services/socket.js';
import { useHomePage } from '../../src/hooks/useHomePage.js';

describe('useHomePage hook', () => {
  const onRoomJoined = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('handleJoin sets error when input is shorter than 6 characters', async () => {
    const { result } = renderHook(() => useHomePage({ onRoomJoined }));

    act(() => result.current.handleInputChange({ target: { value: 'ABC' } }));
    await act(async () => result.current.handleJoin());

    expect(result.current.error).toMatch(/6 characters/i);
    expect(socketService.joinRoom).not.toHaveBeenCalled();
  });

  it('handleJoin sets error when input contains invalid characters', async () => {
    const { result } = renderHook(() => useHomePage({ onRoomJoined }));

    act(() => result.current.handleInputChange({ target: { value: 'ABC!@#' } }));
    await act(async () => result.current.handleJoin());

    expect(result.current.error).toMatch(/only letters and numbers/i);
    expect(socketService.joinRoom).not.toHaveBeenCalled();
  });

  it('handleJoin calls joinRoom and invokes onRoomJoined on valid input', async () => {
    socketService.joinRoom.mockResolvedValue({ operations: [], userId: 'u1' });
    const { result } = renderHook(() => useHomePage({ onRoomJoined }));

    act(() => result.current.handleInputChange({ target: { value: 'ABC123' } }));
    await act(async () => result.current.handleJoin());

    expect(socketService.joinRoom).toHaveBeenCalledWith('ABC123');
    expect(onRoomJoined).toHaveBeenCalled();
  });

  it('handleCreate calls createRoom and invokes onRoomJoined on success', async () => {
    socketService.createRoom.mockResolvedValue({ roomId: 'NEW123', userId: 'u1' });
    const { result } = renderHook(() => useHomePage({ onRoomJoined }));

    await act(async () => result.current.handleCreate());

    expect(socketService.createRoom).toHaveBeenCalledTimes(1);
    expect(onRoomJoined).toHaveBeenCalled();
  });

  it('handleCreate sets error on failure', async () => {
    socketService.createRoom.mockRejectedValue(new Error('SERVER_ERROR'));
    const { result } = renderHook(() => useHomePage({ onRoomJoined }));

    await act(async () => result.current.handleCreate());

    expect(result.current.error).toBeTruthy();
    expect(onRoomJoined).not.toHaveBeenCalled();
  });

  it('handleInputChange clears existing error', async () => {
    const { result } = renderHook(() => useHomePage({ onRoomJoined }));

    // First cause an error
    await act(async () => result.current.handleJoin());
    expect(result.current.error).toBeTruthy();

    // Then clear it by typing
    act(() => result.current.handleInputChange({ target: { value: 'A' } }));
    expect(result.current.error).toBe('');
  });
});
