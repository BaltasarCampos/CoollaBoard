import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';

vi.mock('../../src/services/socket.js', () => ({
  createRoom: vi.fn(),
  joinRoom: vi.fn(),
  onConnectionStatus: vi.fn(),
  offConnectionStatus: vi.fn(),
  getSocket: vi.fn(() => ({ on: vi.fn(), off: vi.fn() })),
}));

import * as socketService from '../../src/services/socket.js';
import ConnectionStatus from '../../src/components/ConnectionStatus.jsx';

describe('ConnectionStatus', () => {
  let statusCallback;

  beforeEach(() => {
    vi.clearAllMocks();
    socketService.onConnectionStatus.mockImplementation((cb) => {
      statusCallback = cb;
    });
  });

  it('renders "Connected" when onConnectionStatus fires "Connected"', () => {
    render(<ConnectionStatus />);
    act(() => statusCallback('Connected'));
    expect(screen.getByText('Connected')).toBeInTheDocument();
  });

  it('renders "Reconnecting" when onConnectionStatus fires "Reconnecting"', () => {
    render(<ConnectionStatus />);
    act(() => statusCallback('Reconnecting'));
    expect(screen.getByText('Reconnecting')).toBeInTheDocument();
  });

  it('renders "Disconnected" when onConnectionStatus fires "Disconnected"', () => {
    render(<ConnectionStatus />);
    act(() => statusCallback('Disconnected'));
    expect(screen.getByText('Disconnected')).toBeInTheDocument();
  });
});
