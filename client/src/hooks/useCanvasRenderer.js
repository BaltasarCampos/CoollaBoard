import { useEffect, useRef } from 'react';
import { toScreen } from '../utils/coordinates.js';
import { VIRTUAL_WIDTH, BRUSH_WIDTH, ERASER_RADIUS, STROKE_COLOR, OP_TYPE } from 'shared/constants.js';

export function useCanvasRenderer(canvasRef, operations, getVisibleOperations) {
  const dirtyRef = useRef(true);

  // Mark dirty whenever operations array reference changes
  useEffect(() => {
    dirtyRef.current = true;
  }, [operations]);

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

  // Resize canvas to fill container and mark dirty
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

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
