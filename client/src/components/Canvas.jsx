import React, { useRef, useEffect, useCallback } from 'react';
import { useCanvas } from '../hooks/useCanvas.js';
import { createPenTool } from '../tools/penTool.js';
import { createEraserTool } from '../tools/eraserTool.js';
import { toScreen } from '../utils/coordinates.js';
import { VIRTUAL_WIDTH, VIRTUAL_HEIGHT, BRUSH_WIDTH, ERASER_RADIUS, STROKE_COLOR, OP_TYPE } from 'shared/constants.js';

const penTool    = createPenTool();
const eraserTool = createEraserTool();

export default function Canvas({ activeTool, userId, roomId, initialOperations = [] }) {
  const canvasRef  = useRef(null);
  const dirtyRef   = useRef(true);
  const { operations, addOperation, getVisibleOperations } = useCanvas();

  // Hydrate initial operations on mount / when room changes
  useEffect(() => {
    for (const op of initialOperations) addOperation(op);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  // Mark dirty whenever operations change
  useEffect(() => { dirtyRef.current = true; }, [operations]);

  // requestAnimationFrame render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let frameId;

    function render() {
      if (dirtyRef.current) {
        dirtyRef.current = false;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        for (const op of getVisibleOperations()) {
          if (op.type === OP_TYPE.DRAW) renderDraw(ctx, op, canvas);
          else if (op.type === OP_TYPE.ERASE) renderErase(ctx, op, canvas);
        }
      }
      frameId = requestAnimationFrame(render);
    }
    frameId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(frameId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [operations]);

  function renderDraw(ctx, op, canvas) {
    if (!op.points || op.points.length < 2) return;
    ctx.save();
    ctx.strokeStyle = STROKE_COLOR;
    ctx.lineWidth = BRUSH_WIDTH;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    const first = toScreen(op.points[0].x, op.points[0].y, canvas);
    ctx.moveTo(first.x, first.y);
    for (let i = 1; i < op.points.length; i++) {
      const pt = toScreen(op.points[i].x, op.points[i].y, canvas);
      ctx.lineTo(pt.x, pt.y);
    }
    ctx.stroke();
    ctx.restore();
  }

  function renderErase(ctx, op, canvas) {
    if (!op.points) return;
    ctx.save();
    for (const pt of op.points) {
      const { x, y } = toScreen(pt.x, pt.y, canvas);
      const radius = ERASER_RADIUS * (canvas.clientWidth / VIRTUAL_WIDTH);
      ctx.clearRect(x - radius, y - radius, radius * 2, radius * 2);
    }
    ctx.restore();
  }

  // Resize canvas to fill container maintaining aspect ratio
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    function resize() {
      canvas.width  = canvas.clientWidth;
      canvas.height = canvas.clientHeight;
      dirtyRef.current = true;
    }
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();
    return () => observer.disconnect();
  }, []);

  const handlePointerDown = useCallback((e) => {
    const canvas = canvasRef.current;
    if (activeTool === 'pen')    penTool.onPointerDown(e.nativeEvent, canvas);
    if (activeTool === 'eraser') eraserTool.onPointerDown(e.nativeEvent, canvas);
    canvas.setPointerCapture(e.pointerId);
  }, [activeTool]);

  const handlePointerMove = useCallback((e) => {
    const canvas = canvasRef.current;
    if (activeTool === 'pen')    penTool.onPointerMove(e.nativeEvent, canvas);
    if (activeTool === 'eraser') eraserTool.onPointerMove(e.nativeEvent, canvas);
  }, [activeTool]);

  const handlePointerUp = useCallback((e) => {
    const canvas = canvasRef.current;
    let localOp = null;
    if (activeTool === 'pen')    localOp = penTool.onPointerUp(e.nativeEvent, canvas);
    if (activeTool === 'eraser') localOp = eraserTool.onPointerUp(e.nativeEvent, canvas);
    if (localOp) addOperation({ ...localOp, sequenceNumber: Date.now(), userId, timestamp: Date.now() });
  }, [activeTool, addOperation, userId]);

  return (
    <canvas
      ref={canvasRef}
      style={{ display: 'block', width: '100%', height: '100%', cursor: activeTool === 'eraser' ? 'crosshair' : 'default', touchAction: 'none' }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    />
  );
}
