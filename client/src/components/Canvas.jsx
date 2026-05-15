import React, { useRef, useEffect, useCallback } from 'react';
import { useCanvas } from '../hooks/useCanvas.js';
import { useCanvasRenderer } from '../hooks/useCanvasRenderer.js';
import { createPenTool } from '../tools/penTool.js';
import { createEraserTool } from '../tools/eraserTool.js';
import { TOOL_NAMES } from 'shared/constants.js';

const penTool    = createPenTool();
const eraserTool = createEraserTool();

export default function Canvas({ activeTool, userId, roomId, initialOperations = [] }) {
  const canvasRef = useRef(null);
  const { operations, addOperation, getVisibleOperations } = useCanvas();

  // Hydrate initial operations on mount / when room changes
  useEffect(() => {
    for (const op of initialOperations) addOperation(op);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  useCanvasRenderer(canvasRef, operations, getVisibleOperations);

  const handlePointerDown = useCallback((e) => {
    const canvas = canvasRef.current;
    if (activeTool === TOOL_NAMES.PEN)    penTool.onPointerDown(e.nativeEvent, canvas);
    if (activeTool === TOOL_NAMES.ERASER) eraserTool.onPointerDown(e.nativeEvent, canvas);
    canvas.setPointerCapture(e.pointerId);
  }, [activeTool]);

  const handlePointerMove = useCallback((e) => {
    const canvas = canvasRef.current;
    if (activeTool === TOOL_NAMES.PEN)    penTool.onPointerMove(e.nativeEvent, canvas);
    if (activeTool === TOOL_NAMES.ERASER) eraserTool.onPointerMove(e.nativeEvent, canvas);
  }, [activeTool]);

  const handlePointerUp = useCallback((e) => {
    const canvas = canvasRef.current;
    let localOp = null;
    if (activeTool === TOOL_NAMES.PEN)    localOp = penTool.onPointerUp(e.nativeEvent, canvas);
    if (activeTool === TOOL_NAMES.ERASER) localOp = eraserTool.onPointerUp(e.nativeEvent, canvas);
    if (localOp) addOperation({ ...localOp, sequenceNumber: Date.now(), userId, timestamp: Date.now() });
  }, [activeTool, addOperation, userId]);

  return (
    <canvas
      ref={canvasRef}
      style={{ display: 'block', width: '100%', height: '100%', cursor: activeTool === TOOL_NAMES.ERASER ? 'crosshair' : 'default', touchAction: 'none' }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    />
  );
}
