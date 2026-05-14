import { emitStroke } from '../services/socket.js';
import { toVirtual } from '../utils/coordinates.js';
import { OP_TYPE } from 'shared/constants.js';

export function createEraserTool() {
  let points = [];
  let drawing = false;

  function onPointerDown(event, canvasEl) {
    drawing = true;
    points = [];
    const v = toVirtual(event.offsetX, event.offsetY, canvasEl);
    points.push(v);
  }

  function onPointerMove(event, canvasEl) {
    if (!drawing) return;
    const v = toVirtual(event.offsetX, event.offsetY, canvasEl);
    points.push(v);
  }

  function onPointerUp(event, canvasEl) {
    if (!drawing) return null;
    drawing = false;

    const v = toVirtual(event.offsetX, event.offsetY, canvasEl);
    points.push(v);

    const operationId = crypto.randomUUID();
    const snapshot = [...points];
    points = [];

    emitStroke(operationId, OP_TYPE.ERASE, snapshot);
    return { operationId, type: OP_TYPE.ERASE, points: snapshot };
  }

  return { onPointerDown, onPointerMove, onPointerUp };
}
