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

  it('applies base connection-status class to element', () => {
    render(<ConnectionStatus />);
    act(() => statusCallback('Connected'));
    expect(screen.getByTestId('connection-status')).toHaveClass('connection-status');
  });

  it('applies connection-status--connected class when connected', () => {
    render(<ConnectionStatus />);
    act(() => statusCallback('Connected'));
    expect(screen.getByTestId('connection-status')).toHaveClass('connection-status--connected');
  });

  it('applies connection-status--reconnecting class when reconnecting', () => {
    render(<ConnectionStatus />);
    act(() => statusCallback('Reconnecting'));
    expect(screen.getByTestId('connection-status')).toHaveClass('connection-status--reconnecting');
  });

  it('applies connection-status--disconnected class when disconnected', () => {
    render(<ConnectionStatus />);
    act(() => statusCallback('Disconnected'));
    expect(screen.getByTestId('connection-status')).toHaveClass('connection-status--disconnected');
  });
});
