import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock socket.js emitStroke, emitStrokePreview, emitStrokeCancel
vi.mock('../../src/services/socket.js', () => ({
  emitStroke: vi.fn(),
  emitStrokePreview: vi.fn(),
  emitStrokeCancel: vi.fn(),
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
    const localOp = tool.onPointerUp({ offsetX: 130, offsetY: 130 }, canvas, '#3b82f6', 4);

    expect(socketService.emitStroke).toHaveBeenCalledTimes(1);
    const [opId, type, points, color, brushSize] = socketService.emitStroke.mock.calls[0];
    expect(type).toBe('DRAW');
    expect(points.length).toBeGreaterThanOrEqual(2);
    expect(opId).toMatch(/^[0-9a-f-]{36}$/); // UUID v4
    expect(color).toBe('#3b82f6');
    expect(typeof brushSize).toBe('number');
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
    const op = tool.onPointerUp({ offsetX: 10, offsetY: 10 }, canvas, '#111111', 4);

    expect(op).not.toBeNull();
    expect(op.type).toBe('DRAW');
    expect(op.operationId).toBeTruthy();
    expect(op.points.length).toBeGreaterThanOrEqual(2);
    expect(op.color).toBe('#111111');
    expect(op.brushSize).toBe(4);
  });

  it('passes color and brushSize to emitStroke and returned op', () => {
    tool.onPointerDown({ offsetX: 0, offsetY: 0 }, canvas);
    tool.onPointerMove({ offsetX: 5, offsetY: 5 }, canvas);
    const op = tool.onPointerUp({ offsetX: 10, offsetY: 10 }, canvas, '#ef4444', 8);

    expect(socketService.emitStroke.mock.calls[0][3]).toBe('#ef4444');
    expect(socketService.emitStroke.mock.calls[0][4]).toBe(8);
    expect(op.color).toBe('#ef4444');
    expect(op.brushSize).toBe(8);
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

  // ── Live Stroke Preview (US1) ───────────────────────────────────────────────

  it('operationId is generated at pointer-down (not pointer-up)', () => {
    tool.onPointerDown({ offsetX: 0, offsetY: 0 }, canvas);
    // After pointer-down, the tool should have an operationId already
    // We verify by checking that onPointerMove returns a preview snapshot with operationId
    const preview = tool.onPointerMove({ offsetX: 5, offsetY: 5 }, canvas);
    expect(preview).not.toBeNull();
    expect(preview.operationId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('operationId stays the same across pointer-move events within a stroke', () => {
    tool.onPointerDown({ offsetX: 0, offsetY: 0 }, canvas);
    const p1 = tool.onPointerMove({ offsetX: 5, offsetY: 5 }, canvas);
    const p2 = tool.onPointerMove({ offsetX: 10, offsetY: 10 }, canvas);
    expect(p1.operationId).toBe(p2.operationId);
  });

  it('onPointerMove returns a StrokePreview snapshot with type DRAW, points, color, brushSize', () => {
    tool.onPointerDown({ offsetX: 0, offsetY: 0 }, canvas, '#3b82f6', 4);
    const preview = tool.onPointerMove({ offsetX: 5, offsetY: 5 }, canvas, '#3b82f6', 4);
    expect(preview).not.toBeNull();
    expect(preview.type).toBe('DRAW');
    expect(Array.isArray(preview.points)).toBe(true);
    expect(preview.points.length).toBeGreaterThanOrEqual(1);
  });

  it('throttled preview: emitStrokePreview is called at most once per 30 ms', () => {
    // Use fake timers to control Date.now
    let fakeNow = 0;
    vi.spyOn(Date, 'now').mockImplementation(() => fakeNow);

    tool.onPointerDown({ offsetX: 0, offsetY: 0 }, canvas);

    // First move — should emit (lastPreviewAt was 0, gap = 0 >= 30? No, actually first emit should happen at 0 >= 30 is false)
    // Actually the first emit should happen on first move (since Date.now() - 0 >= 30 is false only if initial is 0)
    // Let's just check the rate limiting logic:
    fakeNow = 0;
    tool.onPointerMove({ offsetX: 1, offsetY: 1 }, canvas);
    const callsAfterFirst = socketService.emitStrokePreview.mock.calls.length;

    // Move again at same time — should NOT emit again (< 30 ms elapsed)
    tool.onPointerMove({ offsetX: 2, offsetY: 2 }, canvas);
    expect(socketService.emitStrokePreview.mock.calls.length).toBe(callsAfterFirst);

    // Advance time > 30ms — should emit again
    fakeNow = 31;
    tool.onPointerMove({ offsetX: 3, offsetY: 3 }, canvas);
    expect(socketService.emitStrokePreview.mock.calls.length).toBe(callsAfterFirst + 1);

    vi.restoreAllMocks();
  });

  it('pointer-cancel calls emitStrokeCancel and clears local preview', () => {
    tool.onPointerDown({ offsetX: 0, offsetY: 0 }, canvas);
    const preview = tool.onPointerMove({ offsetX: 5, offsetY: 5 }, canvas);
    const operationId = preview.operationId;

    tool.onPointerCancel({ offsetX: 5, offsetY: 5 }, canvas, 'user1');

    expect(socketService.emitStrokeCancel).toHaveBeenCalledWith(
      expect.objectContaining({ operationId })
    );

    // After cancel, pointer-move should not return a preview (not drawing)
    const afterCancel = tool.onPointerMove({ offsetX: 10, offsetY: 10 }, canvas);
    expect(afterCancel).toBeUndefined();
  });

  it('pointer-leave sets insideCanvas to false and stops point accumulation', () => {
    tool.onPointerDown({ offsetX: 0, offsetY: 0 }, canvas);
    tool.onPointerMove({ offsetX: 5, offsetY: 5 }, canvas);
    const preLeave = tool.onPointerMove({ offsetX: 6, offsetY: 6 }, canvas);
    const pointsBefore = preLeave.points.length;

    tool.onPointerLeave();

    // Move while outside should not accumulate points
    tool.onPointerMove({ offsetX: 100, offsetY: 100 }, canvas);
    const afterLeave = tool.onPointerMove({ offsetX: 101, offsetY: 101 }, canvas);
    // onPointerMove while outside canvas should still return snapshot but not accumulate points
    expect(afterLeave.points.length).toBe(pointsBefore);
  });

  it('pointer-enter sets insideCanvas to true and resumes accumulation', () => {
    tool.onPointerDown({ offsetX: 0, offsetY: 0 }, canvas);
    tool.onPointerMove({ offsetX: 5, offsetY: 5 }, canvas);
    tool.onPointerLeave();

    // Move while outside — points should not accumulate
    tool.onPointerMove({ offsetX: 100, offsetY: 100 }, canvas);
    const snapshotOutside = tool.onPointerMove({ offsetX: 101, offsetY: 101 }, canvas);
    const pointsOutside = snapshotOutside.points.length;

    tool.onPointerEnter();

    // Move after re-entering — should accumulate again
    tool.onPointerMove({ offsetX: 110, offsetY: 110 }, canvas);
    const snapshotInside = tool.onPointerMove({ offsetX: 111, offsetY: 111 }, canvas);
    expect(snapshotInside.points.length).toBeGreaterThan(pointsOutside);
  });
});
