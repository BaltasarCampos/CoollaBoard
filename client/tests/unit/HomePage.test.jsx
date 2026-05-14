import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../../src/services/socket.js', () => ({
  createRoom: vi.fn(),
  joinRoom: vi.fn(),
  onConnectionStatus: vi.fn(),
  offConnectionStatus: vi.fn(),
  getSocket: vi.fn(() => ({ on: vi.fn(), off: vi.fn() })),
}));

import * as socketService from '../../src/services/socket.js';
import HomePage from '../../src/components/HomePage.jsx';

describe('HomePage', () => {
  const onRoomJoined = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Create Room button calls createRoom', async () => {
    socketService.createRoom.mockResolvedValue({ roomId: 'ABC123', userId: 'u1' });
    render(<HomePage onRoomJoined={onRoomJoined} message="" />);

    await userEvent.click(screen.getByRole('button', { name: /create room/i }));
    expect(socketService.createRoom).toHaveBeenCalledTimes(1);
  });

  it('shows inline error when join input has fewer than 6 chars', async () => {
    render(<HomePage onRoomJoined={onRoomJoined} message="" />);

    const input = screen.getByPlaceholderText(/room id/i);
    await userEvent.type(input, 'ABC');
    await userEvent.click(screen.getByRole('button', { name: /join room/i }));

    expect(screen.getByText(/6 characters/i)).toBeInTheDocument();
    expect(socketService.joinRoom).not.toHaveBeenCalled();
  });

  it('shows inline error for non-alphanumeric characters in room ID', async () => {
    render(<HomePage onRoomJoined={onRoomJoined} message="" />);

    const input = screen.getByPlaceholderText(/room id/i);
    await userEvent.type(input, 'ABC!@#');
    await userEvent.click(screen.getByRole('button', { name: /join room/i }));

    expect(screen.getByText(/only letters and numbers/i)).toBeInTheDocument();
    expect(socketService.joinRoom).not.toHaveBeenCalled();
  });

  it('silently uppercases lowercase input', async () => {
    socketService.joinRoom.mockResolvedValue({ operations: [] });
    render(<HomePage onRoomJoined={onRoomJoined} message="" />);

    const input = screen.getByPlaceholderText(/room id/i);
    await userEvent.type(input, 'abc123');
    await userEvent.click(screen.getByRole('button', { name: /join room/i }));

    await waitFor(() => {
      expect(socketService.joinRoom).toHaveBeenCalledWith('ABC123');
    });
  });

  it('displays ROOM_NOT_FOUND error message', async () => {
    socketService.joinRoom.mockRejectedValue(new Error('ROOM_NOT_FOUND'));
    render(<HomePage onRoomJoined={onRoomJoined} message="" />);

    const input = screen.getByPlaceholderText(/room id/i);
    await userEvent.type(input, 'ZZZZZZ');
    await userEvent.click(screen.getByRole('button', { name: /join room/i }));

    await waitFor(() => {
      expect(screen.getByText(/room not found/i)).toBeInTheDocument();
    });
  });

  it('submits cleanly with a valid 6-char ID', async () => {
    socketService.joinRoom.mockResolvedValue({ operations: [] });
    render(<HomePage onRoomJoined={onRoomJoined} message="" />);

    const input = screen.getByPlaceholderText(/room id/i);
    await userEvent.type(input, 'ABCDEF');
    await userEvent.click(screen.getByRole('button', { name: /join room/i }));

    await waitFor(() => {
      expect(onRoomJoined).toHaveBeenCalled();
    });
  });
});
