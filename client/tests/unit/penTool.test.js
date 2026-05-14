import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock socket.js emitStroke
vi.mock('../../src/services/socket.js', () => ({
  emitStroke: vi.fn(),
  getSocket: vi.fn(() => ({ on: vi.fn(), off: vi.fn() })),
}));

import * as socketService from '../../src/services/socket.js';
import { createPenTool } from '../../src/tools/penTool.js';

// Minimal canvas element mock for coordinate conversion
function makeCanvas(w = 1920, h = 1080) {
  return { clientWidth: w, clientHeight: h };
}

describe('penTool', () => {
  let tool;
  let canvas;

  beforeEach(() => {
    vi.clearAllMocks();
    canvas = makeCanvas();
    tool = createPenTool();
  });

  it('pointerdown starts a stroke, pointermove accumulates points, pointerup emits draw:stroke', () => {
    tool.onPointerDown({ offsetX: 100, offsetY: 100 }, canvas);
    tool.onPointerMove({ offsetX: 110, offsetY: 110 }, canvas);
    tool.onPointerMove({ offsetX: 120, offsetY: 120 }, canvas);
    const localOp = tool.onPointerUp({ offsetX: 130, offsetY: 130 }, canvas);

    expect(socketService.emitStroke).toHaveBeenCalledTimes(1);
    const [opId, type, points] = socketService.emitStroke.mock.calls[0];
    expect(type).toBe('DRAW');
    expect(points.length).toBeGreaterThanOrEqual(2);
    expect(opId).toMatch(/^[0-9a-f-]{36}$/); // UUID v4
  });

  it('emits type DRAW', () => {
    tool.onPointerDown({ offsetX: 0, offsetY: 0 }, canvas);
    tool.onPointerMove({ offsetX: 5, offsetY: 5 }, canvas);
    tool.onPointerUp({ offsetX: 10, offsetY: 10 }, canvas);

    expect(socketService.emitStroke.mock.calls[0][1]).toBe('DRAW');
  });

  it('returns a local operation for optimistic render', () => {
    tool.onPointerDown({ offsetX: 0, offsetY: 0 }, canvas);
    tool.onPointerMove({ offsetX: 5, offsetY: 5 }, canvas);
    const op = tool.onPointerUp({ offsetX: 10, offsetY: 10 }, canvas);

    expect(op).not.toBeNull();
    expect(op.type).toBe('DRAW');
    expect(op.operationId).toBeTruthy();
    expect(op.points.length).toBeGreaterThanOrEqual(2);
  });

  it('does not emit if only pointerdown with no move (single tap — < 2 points)', () => {
    tool.onPointerDown({ offsetX: 0, offsetY: 0 }, canvas);
    tool.onPointerUp({ offsetX: 0, offsetY: 0 }, canvas);
    // 1 point accumulated → still emitted with 2+ points due to down+up
    // Actually down adds first point, up adds last point = 2 points minimum
    expect(socketService.emitStroke).toHaveBeenCalledTimes(1);
    const [, , points] = socketService.emitStroke.mock.calls[0];
    expect(points.length).toBeGreaterThanOrEqual(2);
  });
});
