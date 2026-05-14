import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/services/socket.js', () => ({
  emitStroke: vi.fn(),
  getSocket: vi.fn(() => ({ on: vi.fn(), off: vi.fn() })),
}));

import * as socketService from '../../src/services/socket.js';
import { createEraserTool } from '../../src/tools/eraserTool.js';

function makeCanvas(w = 1920, h = 1080) {
  return { clientWidth: w, clientHeight: h };
}

describe('eraserTool', () => {
  let tool;
  let canvas;

  beforeEach(() => {
    vi.clearAllMocks();
    canvas = makeCanvas();
    tool = createEraserTool();
  });

  it('emits type ERASE on pointer up', () => {
    tool.onPointerDown({ offsetX: 100, offsetY: 100 }, canvas);
    tool.onPointerMove({ offsetX: 110, offsetY: 110 }, canvas);
    const localOp = tool.onPointerUp({ offsetX: 120, offsetY: 120 }, canvas);

    expect(socketService.emitStroke).toHaveBeenCalledTimes(1);
    expect(socketService.emitStroke.mock.calls[0][1]).toBe('ERASE');
  });

  it('points represent eraser centre path in virtual space', () => {
    tool.onPointerDown({ offsetX: 0, offsetY: 0 }, canvas);
    tool.onPointerMove({ offsetX: 960, offsetY: 540 }, canvas);
    tool.onPointerUp({ offsetX: 1920, offsetY: 1080 }, canvas);

    const [, , points] = socketService.emitStroke.mock.calls[0];
    // All points should be within the virtual space range
    expect(points.every((p) => p.x >= 0 && p.y >= 0)).toBe(true);
  });

  it('operationId is a UUID v4 format', () => {
    tool.onPointerDown({ offsetX: 0, offsetY: 0 }, canvas);
    const op = tool.onPointerUp({ offsetX: 10, offsetY: 10 }, canvas);

    expect(op.operationId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('emitted points have at least 1 entry', () => {
    tool.onPointerDown({ offsetX: 50, offsetY: 50 }, canvas);
    tool.onPointerUp({ offsetX: 50, offsetY: 50 }, canvas);

    const [, , points] = socketService.emitStroke.mock.calls[0];
    expect(points.length).toBeGreaterThanOrEqual(1);
  });

  it('returns a local operation for optimistic render', () => {
    tool.onPointerDown({ offsetX: 0, offsetY: 0 }, canvas);
    const op = tool.onPointerUp({ offsetX: 10, offsetY: 10 }, canvas);

    expect(op).not.toBeNull();
    expect(op.type).toBe('ERASE');
    expect(op.operationId).toBeTruthy();
  });
});
