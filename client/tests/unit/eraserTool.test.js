import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/services/socket.js', () => ({
  emitStroke: vi.fn(),
  emitStrokePreview: vi.fn(),
  emitStrokeCancel: vi.fn(),
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

  // ── Live Stroke Preview (US1) ───────────────────────────────────────────────

  it('operationId is generated at pointer-down', () => {
    tool.onPointerDown({ offsetX: 0, offsetY: 0 }, canvas);
    const preview = tool.onPointerMove({ offsetX: 5, offsetY: 5 }, canvas);
    expect(preview).not.toBeNull();
    expect(preview.operationId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('onPointerMove returns a StrokePreview snapshot with type ERASE', () => {
    tool.onPointerDown({ offsetX: 0, offsetY: 0 }, canvas);
    const preview = tool.onPointerMove({ offsetX: 5, offsetY: 5 }, canvas);
    expect(preview.type).toBe('ERASE');
    expect(Array.isArray(preview.points)).toBe(true);
  });

  it('ERASE preview payload omits color and brushSize fields', () => {
    tool.onPointerDown({ offsetX: 0, offsetY: 0 }, canvas);
    const preview = tool.onPointerMove({ offsetX: 5, offsetY: 5 }, canvas);
    expect(preview.color).toBeUndefined();
    expect(preview.brushSize).toBeUndefined();
  });

  it('throttled preview: emitStrokePreview is called at most once per 30 ms', () => {
    let fakeNow = 0;
    vi.spyOn(Date, 'now').mockImplementation(() => fakeNow);

    tool.onPointerDown({ offsetX: 0, offsetY: 0 }, canvas);

    fakeNow = 0;
    tool.onPointerMove({ offsetX: 1, offsetY: 1 }, canvas);
    const callsAfterFirst = socketService.emitStrokePreview.mock.calls.length;

    tool.onPointerMove({ offsetX: 2, offsetY: 2 }, canvas);
    expect(socketService.emitStrokePreview.mock.calls.length).toBe(callsAfterFirst);

    fakeNow = 31;
    tool.onPointerMove({ offsetX: 3, offsetY: 3 }, canvas);
    expect(socketService.emitStrokePreview.mock.calls.length).toBe(callsAfterFirst + 1);

    vi.restoreAllMocks();
  });

  it('pointer-cancel calls emitStrokeCancel and clears local state', () => {
    tool.onPointerDown({ offsetX: 0, offsetY: 0 }, canvas);
    const preview = tool.onPointerMove({ offsetX: 5, offsetY: 5 }, canvas);
    const operationId = preview.operationId;

    tool.onPointerCancel({ offsetX: 5, offsetY: 5 }, canvas, 'user1');

    expect(socketService.emitStrokeCancel).toHaveBeenCalledWith(
      expect.objectContaining({ operationId })
    );

    const afterCancel = tool.onPointerMove({ offsetX: 10, offsetY: 10 }, canvas);
    expect(afterCancel).toBeUndefined();
  });

  it('pointer-leave sets insideCanvas to false (stops accumulating points)', () => {
    tool.onPointerDown({ offsetX: 0, offsetY: 0 }, canvas);
    tool.onPointerMove({ offsetX: 5, offsetY: 5 }, canvas);
    const preLeave = tool.onPointerMove({ offsetX: 6, offsetY: 6 }, canvas);
    const pointsBefore = preLeave.points.length;

    tool.onPointerLeave();

    tool.onPointerMove({ offsetX: 100, offsetY: 100 }, canvas);
    const afterLeave = tool.onPointerMove({ offsetX: 101, offsetY: 101 }, canvas);
    expect(afterLeave.points.length).toBe(pointsBefore);
  });

  it('pointer-enter sets insideCanvas to true (resumes accumulation)', () => {
    tool.onPointerDown({ offsetX: 0, offsetY: 0 }, canvas);
    tool.onPointerMove({ offsetX: 5, offsetY: 5 }, canvas);
    tool.onPointerLeave();

    tool.onPointerMove({ offsetX: 100, offsetY: 100 }, canvas);
    const snapshotOutside = tool.onPointerMove({ offsetX: 101, offsetY: 101 }, canvas);
    const pointsOutside = snapshotOutside.points.length;

    tool.onPointerEnter();

    tool.onPointerMove({ offsetX: 110, offsetY: 110 }, canvas);
    const snapshotInside = tool.onPointerMove({ offsetX: 111, offsetY: 111 }, canvas);
    expect(snapshotInside.points.length).toBeGreaterThan(pointsOutside);
  });

  it('emitStrokePreview payload for ERASE does not include color or brushSize', () => {
    let fakeNow = 100;
    vi.spyOn(Date, 'now').mockImplementation(() => fakeNow);

    tool.onPointerDown({ offsetX: 0, offsetY: 0 }, canvas);
    fakeNow = 131; // ensure 30ms has passed
    tool.onPointerMove({ offsetX: 5, offsetY: 5 }, canvas);

    expect(socketService.emitStrokePreview).toHaveBeenCalled();
    const payload = socketService.emitStrokePreview.mock.calls[0][0];
    expect(payload.color).toBeUndefined();
    expect(payload.brushSize).toBeUndefined();
    expect(payload.type).toBe('ERASE');

    vi.restoreAllMocks();
  });
});
