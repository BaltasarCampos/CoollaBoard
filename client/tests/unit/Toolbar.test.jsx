import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../../src/services/socket.js', () => ({
  emitClear: vi.fn(),
  getSocket: vi.fn(() => ({ on: vi.fn(), off: vi.fn() })),
}));

import * as socketService from '../../src/services/socket.js';
import Toolbar from '../../src/components/Toolbar.jsx';

describe('Toolbar + ConfirmDialog (Clear Canvas)', () => {
  const onToolChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('clicking Clear Canvas renders inline ConfirmDialog', async () => {
    render(<Toolbar activeTool="pen" onToolChange={onToolChange} />);
    await userEvent.click(screen.getByRole('button', { name: /clear canvas/i }));
    expect(screen.getByText(/are you sure/i)).toBeInTheDocument();
  });

  it('clicking Confirm calls emitClear', async () => {
    render(<Toolbar activeTool="pen" onToolChange={onToolChange} />);
    await userEvent.click(screen.getByRole('button', { name: /clear canvas/i }));
    await userEvent.click(screen.getByRole('button', { name: /confirm/i }));

    expect(socketService.emitClear).toHaveBeenCalledTimes(1);
  });

  it('clicking Cancel hides dialog without calling emitClear', async () => {
    render(<Toolbar activeTool="pen" onToolChange={onToolChange} />);
    await userEvent.click(screen.getByRole('button', { name: /clear canvas/i }));
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }));

    expect(socketService.emitClear).not.toHaveBeenCalled();
    expect(screen.queryByText(/are you sure/i)).not.toBeInTheDocument();
  });

  it('active Pen tool button has toolbar__btn--active class', () => {
    render(<Toolbar activeTool="pen" onToolChange={onToolChange} />);
    const penBtn = screen.getByRole('button', { name: /pen/i });
    expect(penBtn).toHaveClass('toolbar__btn--active');
  });

  it('inactive Eraser button does not have toolbar__btn--active class', () => {
    render(<Toolbar activeTool="pen" onToolChange={onToolChange} />);
    const eraserBtn = screen.getByRole('button', { name: /eraser/i });
    expect(eraserBtn).not.toHaveClass('toolbar__btn--active');
  });

  it('all tool buttons have base toolbar__btn class', () => {
    render(<Toolbar activeTool="pen" onToolChange={onToolChange} />);
    const penBtn = screen.getByRole('button', { name: /pen/i });
    const eraserBtn = screen.getByRole('button', { name: /eraser/i });
    expect(penBtn).toHaveClass('toolbar__btn');
    expect(eraserBtn).toHaveClass('toolbar__btn');
  });
});
