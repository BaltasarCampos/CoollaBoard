import { emitStroke } from '../services/socket.js';
import { toVirtual } from '../utils/coordinates.js';
import { OP_TYPE } from 'shared/constants.js';

export function createPenTool() {
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

    // Need at least 2 points
    if (points.length < 2) return null;

    const operationId = crypto.randomUUID();
    const snapshot = [...points];
    points = [];

    emitStroke(operationId, OP_TYPE.DRAW, snapshot);

    return { operationId, type: OP_TYPE.DRAW, points: snapshot };
  }

  return { onPointerDown, onPointerMove, onPointerUp };
}
