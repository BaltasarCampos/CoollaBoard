import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRef } from 'react';
import { OP_TYPE, DEFAULT_STROKE_COLOR, DEFAULT_BRUSH_WIDTH } from 'shared/constants.js';

// Stub ResizeObserver
const resizeCallbacks = [];
vi.stubGlobal('ResizeObserver', class {
  constructor(cb) { resizeCallbacks.push(cb); }
  observe() {}
  disconnect() {}
});

// Mock RAF/CAF
let rafCallback = null;
vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((cb) => {
  rafCallback = cb;
  return 1;
});
vi.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation(() => {});

// Mock 2D context
const mockCtx = {
  clearRect: vi.fn(),
  save: vi.fn(),
  restore: vi.fn(),
  beginPath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  stroke: vi.fn(),
  strokeStyle: '',
  lineWidth: 0,
  lineCap: '',
  lineJoin: '',
};

vi.mock('../../src/services/socket.js', () => ({
  getSocket: vi.fn(() => ({ on: vi.fn(), off: vi.fn() })),
  onConnectionStatus: vi.fn(),
  offConnectionStatus: vi.fn(),
}));

import { useCanvasRenderer } from '../../src/hooks/useCanvasRenderer.js';

function flushRaf() {
  if (rafCallback) {
    const cb = rafCallback;
    rafCallback = null;
    cb();
  }
}

describe('useCanvasRenderer hook', () => {
  let canvas;
  let canvasRef;

  beforeEach(() => {
    vi.clearAllMocks();
    rafCallback = null;
    canvas = {
      getContext: vi.fn(() => mockCtx),
      width: 800,
      height: 600,
      clientWidth: 800,
      clientHeight: 600,
    };
  });

  function makeRef(el) {
    const ref = { current: el };
    return ref;
  }

  it('clearRect is called before each render pass', () => {
    const ops = [
      { operationId: 'op1', type: OP_TYPE.DRAW, points: [{ x: 0, y: 0 }, { x: 1, y: 1 }], sequenceNumber: 1, userId: 'u', timestamp: 0 },
    ];
    const canvasRef = makeRef(canvas);
    const getVisibleOps = () => ops;

    renderHook(() => useCanvasRenderer(canvasRef, ops, getVisibleOps));

    act(() => flushRaf());

    expect(mockCtx.clearRect).toHaveBeenCalledWith(0, 0, canvas.width, canvas.height);
  });

  it('renderDraw is called (stroke() invoked) for a DRAW operation', () => {
    const ops = [
      { operationId: 'op1', type: OP_TYPE.DRAW, points: [{ x: 0, y: 0 }, { x: 100, y: 100 }], sequenceNumber: 1, userId: 'u', timestamp: 0 },
    ];
    const canvasRef = makeRef(canvas);
    const getVisibleOps = () => ops;

    renderHook(() => useCanvasRenderer(canvasRef, ops, getVisibleOps));

    act(() => flushRaf());

    expect(mockCtx.stroke).toHaveBeenCalled();
  });

  it('renderErase is called (clearRect with offset) for an ERASE operation', () => {
    const ops = [
      { operationId: 'op2', type: OP_TYPE.ERASE, points: [{ x: 100, y: 100 }], sequenceNumber: 2, userId: 'u', timestamp: 0 },
    ];
    const canvasRef = makeRef(canvas);
    const getVisibleOps = () => ops;

    renderHook(() => useCanvasRenderer(canvasRef, ops, getVisibleOps));

    act(() => flushRaf());

    // clearRect called at least twice: once for canvas clear, once per erase point
    expect(mockCtx.clearRect).toHaveBeenCalledTimes(2);
  });

  it('does not re-render when operations array has not changed (dirtyRef false)', () => {
    const ops = [];
    const canvasRef = makeRef(canvas);
    const getVisibleOps = () => ops;

    renderHook(() => useCanvasRenderer(canvasRef, ops, getVisibleOps));

    // First frame: dirty=true, renders
    act(() => flushRaf());
    const callsAfterFirst = mockCtx.clearRect.mock.calls.length;

    // Second frame without new ops: dirty=false, no re-render
    act(() => flushRaf());
    expect(mockCtx.clearRect.mock.calls.length).toBe(callsAfterFirst);
  });

  it('re-renders when operations array reference changes (dirtyRef reset to true)', () => {
    const ops1 = [];
    const ops2 = [
      { operationId: 'op3', type: OP_TYPE.DRAW, points: [{ x: 0, y: 0 }, { x: 1, y: 1 }], sequenceNumber: 1, userId: 'u', timestamp: 0 },
    ];
    const canvasRef = makeRef(canvas);

    const { rerender } = renderHook(
      ({ ops }) => useCanvasRenderer(canvasRef, ops, () => ops),
      { initialProps: { ops: ops1 } },
    );

    act(() => flushRaf());
    const callsAfterFirst = mockCtx.clearRect.mock.calls.length;

    // Change ops reference → should mark dirty
    rerender({ ops: ops2 });
    act(() => flushRaf());
    expect(mockCtx.clearRect.mock.calls.length).toBeGreaterThan(callsAfterFirst);
  });

  it('renderDraw uses op.color for ctx.strokeStyle', () => {
    const ops = [
      { operationId: 'op1', type: OP_TYPE.DRAW, points: [{ x: 0, y: 0 }, { x: 100, y: 100 }], color: '#ef4444', sequenceNumber: 1, userId: 'u', timestamp: 0 },
    ];
    const canvasRef = makeRef(canvas);
    renderHook(() => useCanvasRenderer(canvasRef, ops, () => ops));
    act(() => flushRaf());
    expect(mockCtx.strokeStyle).toBe('#ef4444');
  });

  it('renderDraw falls back to DEFAULT_STROKE_COLOR when op.color is undefined', () => {
    const ops = [
      { operationId: 'op2', type: OP_TYPE.DRAW, points: [{ x: 0, y: 0 }, { x: 100, y: 100 }], sequenceNumber: 1, userId: 'u', timestamp: 0 },
    ];
    const canvasRef = makeRef(canvas);
    renderHook(() => useCanvasRenderer(canvasRef, ops, () => ops));
    act(() => flushRaf());
    expect(mockCtx.strokeStyle).toBe(DEFAULT_STROKE_COLOR);
  });

  it('renderDraw uses op.brushSize for ctx.lineWidth', () => {
    const ops = [
      { operationId: 'op3', type: OP_TYPE.DRAW, points: [{ x: 0, y: 0 }, { x: 100, y: 100 }], brushSize: 8, sequenceNumber: 1, userId: 'u', timestamp: 0 },
    ];
    const canvasRef = makeRef(canvas);
    renderHook(() => useCanvasRenderer(canvasRef, ops, () => ops));
    act(() => flushRaf());
    expect(mockCtx.lineWidth).toBe(8);
  });

  it('renderDraw falls back to DEFAULT_BRUSH_WIDTH when op.brushSize is undefined', () => {
    const ops = [
      { operationId: 'op4', type: OP_TYPE.DRAW, points: [{ x: 0, y: 0 }, { x: 100, y: 100 }], sequenceNumber: 1, userId: 'u', timestamp: 0 },
    ];
    const canvasRef = makeRef(canvas);
    renderHook(() => useCanvasRenderer(canvasRef, ops, () => ops));
    act(() => flushRaf());
    expect(mockCtx.lineWidth).toBe(DEFAULT_BRUSH_WIDTH);
  });
});

// ── Preview Layer Rendering (US1) ──────────────────────────────────────────────

describe('useCanvasRenderer — preview canvas (US1)', () => {
  let mainCanvas;
  let previewCanvas;
  const previewCtx = {
    clearRect: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    rect: vi.fn(),
    strokeStyle: '',
    lineWidth: 0,
    lineCap: '',
    lineJoin: '',
    globalAlpha: 1,
    fillStyle: '',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    rafCallback = null;
    mainCanvas = {
      getContext: vi.fn(() => mockCtx),
      width: 800,
      height: 600,
      clientWidth: 800,
      clientHeight: 600,
    };
    previewCanvas = {
      getContext: vi.fn(() => previewCtx),
      width: 800,
      height: 600,
      clientWidth: 800,
      clientHeight: 600,
    };
  });

  function makeRef(el) {
    return { current: el };
  }

  it('renderer accepts previewCanvasRef and previews as additional params', () => {
    const ops = [];
    const previews = new Map();
    const canvasRef = makeRef(mainCanvas);
    const previewCanvasRef = makeRef(previewCanvas);

    // Should not throw
    expect(() => {
      renderHook(() => useCanvasRenderer(canvasRef, ops, () => ops, previewCanvasRef, previews));
    }).not.toThrow();
  });

  it('overlay canvas is cleared at the start of each dirty frame with preview entries', () => {
    const ops = [];
    const previews = new Map([
      ['op1', { operationId: 'op1', type: OP_TYPE.DRAW, points: [{ x: 0, y: 0 }, { x: 10, y: 10 }], color: '#111111', brushSize: 4 }],
    ]);
    const canvasRef = makeRef(mainCanvas);
    const previewCanvasRef = makeRef(previewCanvas);

    renderHook(() => useCanvasRenderer(canvasRef, ops, () => ops, previewCanvasRef, previews));

    act(() => flushRaf());

    expect(previewCtx.clearRect).toHaveBeenCalledWith(0, 0, previewCanvas.width, previewCanvas.height);
  });

  it('a DRAW preview entry causes stroke rendering on the preview canvas', () => {
    const ops = [];
    const previews = new Map([
      ['op1', { operationId: 'op1', type: OP_TYPE.DRAW, points: [{ x: 0, y: 0 }, { x: 100, y: 100 }], color: '#3b82f6', brushSize: 4 }],
    ]);
    const canvasRef = makeRef(mainCanvas);
    const previewCanvasRef = makeRef(previewCanvas);

    renderHook(() => useCanvasRenderer(canvasRef, ops, () => ops, previewCanvasRef, previews));

    act(() => flushRaf());

    expect(previewCtx.stroke).toHaveBeenCalled();
    expect(previewCtx.strokeStyle).toBe('#3b82f6');
  });

  it('an ERASE preview entry renders a visible indicator (fill/stroke) on the preview canvas', () => {
    const ops = [];
    const previews = new Map([
      ['op2', { operationId: 'op2', type: OP_TYPE.ERASE, points: [{ x: 100, y: 100 }] }],
    ]);
    const canvasRef = makeRef(mainCanvas);
    const previewCanvasRef = makeRef(previewCanvas);

    renderHook(() => useCanvasRenderer(canvasRef, ops, () => ops, previewCanvasRef, previews));

    act(() => flushRaf());

    // clearRect called once for the full canvas clear; erase preview uses fill+stroke, not clearRect
    expect(previewCtx.clearRect).toHaveBeenCalledTimes(1);
    expect(previewCtx.fill).toHaveBeenCalled();
  });

  it('empty previews map clears the overlay but makes no paint calls', () => {
    const ops = [];
    const previews = new Map();
    const canvasRef = makeRef(mainCanvas);
    const previewCanvasRef = makeRef(previewCanvas);

    renderHook(() => useCanvasRenderer(canvasRef, ops, () => ops, previewCanvasRef, previews));

    act(() => flushRaf());

    expect(previewCtx.clearRect).toHaveBeenCalledTimes(1);
    expect(previewCtx.stroke).not.toHaveBeenCalled();
    expect(previewCtx.fill).not.toHaveBeenCalled();
  });
});
