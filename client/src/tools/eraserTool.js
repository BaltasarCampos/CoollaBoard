import { emitStroke, emitStrokePreview, emitStrokeCancel } from '../services/socket.js';
import { toVirtual } from '../utils/coordinates.js';
import { OP_TYPE } from 'shared/constants.js';

export function createEraserTool() {
  let points = [];
  let drawing = false;
  let operationId = null;
  let lastPreviewAt = 0;
  let insideCanvas = true;
  let currentUserId = null;

  function onPointerDown(event, canvasEl, userId) {
    drawing = true;
    insideCanvas = true;
    points = [];
    operationId = crypto.randomUUID();
    lastPreviewAt = 0;
    currentUserId = userId ?? null;
    const v = toVirtual(event.offsetX, event.offsetY, canvasEl);
    points.push(v);
  }

  function onPointerMove(event, canvasEl) {
    if (!drawing) return;
    if (insideCanvas) {
      const v = toVirtual(event.offsetX, event.offsetY, canvasEl);
      points.push(v);
    }

    const now = Date.now();
    if (now - lastPreviewAt >= 30) {
      lastPreviewAt = now;
      emitStrokePreview({ operationId, userId: currentUserId, type: OP_TYPE.ERASE, points: [...points] });
    }

    return { operationId, type: OP_TYPE.ERASE, points: [...points] };
  }

  function onPointerUp(event, canvasEl) {
    if (!drawing) return null;
    drawing = false;

    const v = toVirtual(event.offsetX, event.offsetY, canvasEl);
    points.push(v);

    const currentOperationId = operationId;
    const snapshot = [...points];
    points = [];
    operationId = null;

    emitStroke(currentOperationId, OP_TYPE.ERASE, snapshot);
    return { operationId: currentOperationId, type: OP_TYPE.ERASE, points: snapshot };
  }

  function onPointerCancel(event, canvasEl, userId) {
    if (!drawing) return;
    drawing = false;
    emitStrokeCancel({ operationId, userId });
    operationId = null;
    points = [];
  }

  function onPointerLeave() {
    insideCanvas = false;
  }

  function onPointerEnter() {
    insideCanvas = true;
  }

  return { onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onPointerLeave, onPointerEnter };
}
