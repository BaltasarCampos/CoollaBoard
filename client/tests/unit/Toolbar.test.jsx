import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../../src/services/socket.js', () => ({
  emitClear: vi.fn(),
  getSocket: vi.fn(() => ({ on: vi.fn(), off: vi.fn() })),
}));

import * as socketService from '../../src/services/socket.js';
import Toolbar from '../../src/components/Toolbar.jsx';

const defaultProps = {
  activeTool: 'pen',
  onToolChange: vi.fn(),
  color: '#111111',
  onColorChange: vi.fn(),
  brushSize: 4,
  onBrushSizeChange: vi.fn(),
};

describe('Toolbar + ConfirmDialog (Clear Canvas)', () => {
  const onToolChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('clicking Clear Canvas renders inline ConfirmDialog', async () => {
    render(<Toolbar {...defaultProps} activeTool="pen" onToolChange={onToolChange} />);
    await userEvent.click(screen.getByRole('button', { name: /clear canvas/i }));
    expect(screen.getByText(/are you sure/i)).toBeInTheDocument();
  });

  it('clicking Confirm calls emitClear', async () => {
    render(<Toolbar {...defaultProps} activeTool="pen" onToolChange={onToolChange} />);
    await userEvent.click(screen.getByRole('button', { name: /clear canvas/i }));
    await userEvent.click(screen.getByRole('button', { name: /confirm/i }));

    expect(socketService.emitClear).toHaveBeenCalledTimes(1);
  });

  it('clicking Cancel hides dialog without calling emitClear', async () => {
    render(<Toolbar {...defaultProps} activeTool="pen" onToolChange={onToolChange} />);
    await userEvent.click(screen.getByRole('button', { name: /clear canvas/i }));
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }));

    expect(socketService.emitClear).not.toHaveBeenCalled();
    expect(screen.queryByText(/are you sure/i)).not.toBeInTheDocument();
  });

  it('active Pen tool button has toolbar__btn--active class', () => {
    render(<Toolbar {...defaultProps} activeTool="pen" onToolChange={onToolChange} />);
    const penBtn = screen.getByRole('button', { name: /pen/i });
    expect(penBtn).toHaveClass('toolbar__btn--active');
  });

  it('inactive Eraser button does not have toolbar__btn--active class', () => {
    render(<Toolbar {...defaultProps} activeTool="pen" onToolChange={onToolChange} />);
    const eraserBtn = screen.getByRole('button', { name: /eraser/i });
    expect(eraserBtn).not.toHaveClass('toolbar__btn--active');
  });

  it('all tool buttons have base toolbar__btn class', () => {
    render(<Toolbar {...defaultProps} activeTool="pen" onToolChange={onToolChange} />);
    const penBtn = screen.getByRole('button', { name: /pen/i });
    const eraserBtn = screen.getByRole('button', { name: /eraser/i });
    expect(penBtn).toHaveClass('toolbar__btn');
    expect(eraserBtn).toHaveClass('toolbar__btn');
  });

  it('renders 8 color swatch buttons', () => {
    const { container } = render(<Toolbar {...defaultProps} />);
    const swatches = container.querySelectorAll('.toolbar__color-swatch');
    expect(swatches).toHaveLength(8);
  });

  it('clicking a color swatch calls onColorChange with its hex value', async () => {
    const onColorChange = vi.fn();
    const { container } = render(<Toolbar {...defaultProps} onColorChange={onColorChange} />);
    const swatches = container.querySelectorAll('.toolbar__color-swatch');
    await userEvent.click(swatches[1]); // '#ffffff'
    expect(onColorChange).toHaveBeenCalledWith('#ffffff');
  });

  it('active color swatch has toolbar__color-swatch--active class', () => {
    const { container } = render(<Toolbar {...defaultProps} color="#ef4444" />);
    const swatches = container.querySelectorAll('.toolbar__color-swatch');
    const redSwatch = Array.from(swatches).find((el) => el.getAttribute('aria-label') === '#ef4444');
    expect(redSwatch).toHaveClass('toolbar__color-swatch--active');
    const nonActive = Array.from(swatches).filter((el) => el.getAttribute('aria-label') !== '#ef4444');
    for (const el of nonActive) {
      expect(el).not.toHaveClass('toolbar__color-swatch--active');
    }
  });

  it('renders 3 brush size buttons', () => {
    const { container } = render(<Toolbar {...defaultProps} />);
    const sizeBtns = container.querySelectorAll('.toolbar__size-btn');
    expect(sizeBtns).toHaveLength(3);
  });

  it('clicking a brush size button calls onBrushSizeChange with its numeric value', async () => {
    const onBrushSizeChange = vi.fn();
    const { container } = render(<Toolbar {...defaultProps} onBrushSizeChange={onBrushSizeChange} />);
    const sizeBtns = container.querySelectorAll('.toolbar__size-btn');
    const largeBtn = Array.from(sizeBtns).find((el) => el.textContent === 'L');
    await userEvent.click(largeBtn);
    expect(onBrushSizeChange).toHaveBeenCalledWith(8);
  });

  it('active brush size button has toolbar__size-btn--active class', () => {
    const { container } = render(<Toolbar {...defaultProps} brushSize={8} />);
    const sizeBtns = container.querySelectorAll('.toolbar__size-btn');
    const largeBtn = Array.from(sizeBtns).find((el) => el.textContent === 'L');
    const smallBtn = Array.from(sizeBtns).find((el) => el.textContent === 'S');
    const medBtn = Array.from(sizeBtns).find((el) => el.textContent === 'M');
    expect(largeBtn).toHaveClass('toolbar__size-btn--active');
    expect(smallBtn).not.toHaveClass('toolbar__size-btn--active');
    expect(medBtn).not.toHaveClass('toolbar__size-btn--active');
  });
});

// ── Undo / Redo buttons (US1 + US3) ─────────────────────────────────────────

describe('Toolbar — Undo / Redo buttons', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders an Undo button', () => {
    render(<Toolbar {...defaultProps} onUndo={vi.fn()} canUndo={true} onRedo={vi.fn()} canRedo={false} />);
    expect(screen.getByRole('button', { name: /undo/i })).toBeInTheDocument();
  });

  it('Undo button is disabled when canUndo=false', () => {
    render(<Toolbar {...defaultProps} onUndo={vi.fn()} canUndo={false} onRedo={vi.fn()} canRedo={false} />);
    expect(screen.getByRole('button', { name: /undo/i })).toBeDisabled();
  });

  it('Undo button is enabled when canUndo=true', () => {
    render(<Toolbar {...defaultProps} onUndo={vi.fn()} canUndo={true} onRedo={vi.fn()} canRedo={false} />);
    expect(screen.getByRole('button', { name: /undo/i })).not.toBeDisabled();
  });

  it('clicking Undo button calls onUndo prop', async () => {
    const onUndo = vi.fn();
    render(<Toolbar {...defaultProps} onUndo={onUndo} canUndo={true} onRedo={vi.fn()} canRedo={false} />);
    await userEvent.click(screen.getByRole('button', { name: /undo/i }));
    expect(onUndo).toHaveBeenCalledTimes(1);
  });

  it('renders a Redo button', () => {
    render(<Toolbar {...defaultProps} onUndo={vi.fn()} canUndo={false} onRedo={vi.fn()} canRedo={true} />);
    expect(screen.getByRole('button', { name: /redo/i })).toBeInTheDocument();
  });

  it('Redo button is disabled when canRedo=false', () => {
    render(<Toolbar {...defaultProps} onUndo={vi.fn()} canUndo={false} onRedo={vi.fn()} canRedo={false} />);
    expect(screen.getByRole('button', { name: /redo/i })).toBeDisabled();
  });

  it('Redo button is enabled when canRedo=true', () => {
    render(<Toolbar {...defaultProps} onUndo={vi.fn()} canUndo={false} onRedo={vi.fn()} canRedo={true} />);
    expect(screen.getByRole('button', { name: /redo/i })).not.toBeDisabled();
  });

  it('clicking Redo button calls onRedo prop', async () => {
    const onRedo = vi.fn();
    render(<Toolbar {...defaultProps} onUndo={vi.fn()} canUndo={false} onRedo={onRedo} canRedo={true} />);
    await userEvent.click(screen.getByRole('button', { name: /redo/i }));
    expect(onRedo).toHaveBeenCalledTimes(1);
  });
});
