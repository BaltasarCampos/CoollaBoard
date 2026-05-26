import React, { useRef, useEffect, useCallback } from 'react';
import '../styles/components/canvas.css';
import { useCanvasRenderer } from '../hooks/useCanvasRenderer.js';
import { usePreviewLayer } from '../hooks/usePreviewLayer.js';
import { createPenTool } from '../tools/penTool.js';
import { createEraserTool } from '../tools/eraserTool.js';
import { TOOL_NAMES } from 'shared/constants.js';

const penTool    = createPenTool();
const eraserTool = createEraserTool();

export default function Canvas({ addOperation, removeOperation, getVisibleOperations, canUndo, canRedo, requestUndo, requestRedo, onExternalClear, activeTool, color, brushSize, userId, roomId }) {
  const canvasRef = useRef(null);
  const previewCanvasRef = useRef(null);
  const { previews, setPreview, removePreview, clearAllPreviews } = usePreviewLayer();

  // Expose clearAllPreviews to RoomPage so external CANVAS_CLEARED events flush previews
  useEffect(() => {
    if (onExternalClear) {
      onExternalClear.current = clearAllPreviews;
    }
  }, [onExternalClear, clearAllPreviews]);

  // getVisibleOperations changes reference whenever operations change — use as both
  // "operations" dependency (for dirty-marking) and the actual renderer function
  useCanvasRenderer(canvasRef, getVisibleOperations, getVisibleOperations, previewCanvasRef, previews);

  const handlePointerDown = useCallback((e) => {
    const canvas = canvasRef.current;
    if (activeTool === TOOL_NAMES.PEN)    penTool.onPointerDown(e.nativeEvent, canvas, userId);
    if (activeTool === TOOL_NAMES.ERASER) eraserTool.onPointerDown(e.nativeEvent, canvas, userId);
    canvas.setPointerCapture(e.pointerId);
  }, [activeTool, userId]);

  const handlePointerMove = useCallback((e) => {
    const canvas = canvasRef.current;
    let preview = null;
    if (activeTool === TOOL_NAMES.PEN)    preview = penTool.onPointerMove(e.nativeEvent, canvas, color, brushSize);
    if (activeTool === TOOL_NAMES.ERASER) preview = eraserTool.onPointerMove(e.nativeEvent, canvas);
    if (preview) setPreview(preview);
  }, [activeTool, color, brushSize, setPreview]);

  const handlePointerUp = useCallback((e) => {
    const canvas = canvasRef.current;
    let localOp = null;
    if (activeTool === TOOL_NAMES.PEN) {
      const preview = penTool.onPointerMove(e.nativeEvent, canvas, color, brushSize);
      if (preview) removePreview(preview.operationId);
      localOp = penTool.onPointerUp(e.nativeEvent, canvas, color, brushSize);
    }
    if (activeTool === TOOL_NAMES.ERASER) {
      const preview = eraserTool.onPointerMove(e.nativeEvent, canvas);
      if (preview) removePreview(preview.operationId);
      localOp = eraserTool.onPointerUp(e.nativeEvent, canvas);
    }
    if (localOp) addOperation({ ...localOp, sequenceNumber: Date.now(), userId, timestamp: Date.now() });
  }, [activeTool, addOperation, userId, color, brushSize, removePreview]);

  const handlePointerCancel = useCallback((e) => {
    const canvas = canvasRef.current;
    if (activeTool === TOOL_NAMES.PEN) {
      penTool.onPointerCancel(e.nativeEvent, canvas, userId);
    }
    if (activeTool === TOOL_NAMES.ERASER) {
      eraserTool.onPointerCancel(e.nativeEvent, canvas, userId);
    }
  }, [activeTool, userId]);

  const handlePointerLeave = useCallback(() => {
    if (activeTool === TOOL_NAMES.PEN)    penTool.onPointerLeave();
    if (activeTool === TOOL_NAMES.ERASER) eraserTool.onPointerLeave();
  }, [activeTool]);

  const handlePointerEnter = useCallback(() => {
    if (activeTool === TOOL_NAMES.PEN)    penTool.onPointerEnter();
    if (activeTool === TOOL_NAMES.ERASER) eraserTool.onPointerEnter();
  }, [activeTool]);

  return (
    <div className="canvas-wrapper">
      <canvas
        ref={canvasRef}
        className={`canvas-main${activeTool === TOOL_NAMES.ERASER ? ' canvas-main--eraser' : ''}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onPointerLeave={handlePointerLeave}
        onPointerEnter={handlePointerEnter}
      />
      <canvas
        ref={previewCanvasRef}
        className="canvas-preview"
      />
    </div>
  );
}

