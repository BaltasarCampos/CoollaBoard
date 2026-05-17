# Quickstart: Live Stroke Preview

**Feature**: 005-live-stroke-preview  
**Date**: 2026-05-17  
**For**: Developers implementing this feature

---

## What This Feature Does

Adds real-time in-progress stroke rendering so users see drawing strokes appear as they happen — both on their own canvas and on collaborators' canvases:

- **Local preview**: Drawing user sees their stroke rendered immediately at full opacity from the first pointer-move.
- **Remote preview**: Other users in the same room see in-progress strokes at 60% opacity, updated every 30 ms.
- **Clean handoff**: When a stroke is committed (pointer-up), the preview is replaced atomically by the committed stroke with no visual flicker.
- **Cancel path**: Abandoned strokes (pointer-leave, pointer-cancel, disconnect) cleanly remove the preview from all canvases.

---

## Prerequisites

- Node.js 18+ and npm installed
- Spec 004 (color/brush controls) already merged — color and brush size state is available in `Canvas.jsx` props
- Familiarity with the existing draw flow: `penTool.js` → `socket.js` → `eventHandlers.js` → `useCanvas.js` → `useCanvasRenderer.js`

---

## Key Files to Modify

| File | Change type | What changes |
|------|-------------|--------------|
| `shared/constants.js` | Add constants | 2 new `EVENTS`, 2 new `SERVER_EVENTS` |
| `client/src/services/socket.js` | Add exports | `emitStrokePreview()`, `emitStrokeCancel()` |
| `client/src/tools/penTool.js` | Modify | Assign `operationId` at pointer-down; emit throttled preview in `onPointerMove`; expose cancel method |
| `client/src/tools/eraserTool.js` | Modify | Same as penTool |
| `client/src/hooks/useCanvas.js` | Modify | Add `previews` Map state; handle `PREVIEW_BROADCAST` / `PREVIEW_CANCEL` / commit preview removal / `canvas:cleared` clear |
| `client/src/hooks/useCanvasRenderer.js` | Modify | Add preview rendering pass (remote at 0.6 alpha, local at 1.0 alpha) |
| `client/src/components/Canvas.jsx` | Modify | Remove `setPointerCapture`; add `onPointerLeave` + `onPointerCancel` cancel handlers; pass local preview to renderer |
| `server/src/handlers/eventHandlers.js` | Modify | Relay `draw:stroke-preview`; relay `draw:stroke-cancel`; emit cancel on disconnect; clear `activePreviewId` on commit |

---

## Implementation Order (TDD)

Follow the Red → Green → Refactor cycle. Work in this order to build on stable foundations:

### Step 1 — Constants

Add to `shared/constants.js`:
```javascript
EVENTS.DRAW_STROKE_PREVIEW = 'draw:stroke-preview';
EVENTS.DRAW_STROKE_CANCEL  = 'draw:stroke-cancel';
SERVER_EVENTS.PREVIEW_BROADCAST = 'draw:preview-broadcast';
SERVER_EVENTS.PREVIEW_CANCEL    = 'draw:preview-cancel';
```
No tests needed — constants are verified by consumers.

---

### Step 2 — Socket service (unit tests first)

**Write failing test** in `client/tests/unit/socket.test.js`:
- `emitStrokePreview` emits `draw:stroke-preview` with correct payload
- `emitStrokeCancel` emits `draw:stroke-cancel` with correct payload

**Then implement** in `client/src/services/socket.js`:
```javascript
export function emitStrokePreview(operationId, type, points, color, brushSize) {
  socket.emit(EVENTS.DRAW_STROKE_PREVIEW, { operationId, type, points, color, brushSize });
}

export function emitStrokeCancel(operationId) {
  socket.emit(EVENTS.DRAW_STROKE_CANCEL, { operationId });
}
```

---

### Step 3 — Tool modules (unit tests first)

**Write failing tests** in `client/tests/unit/penTool.test.js` and `eraserTool.test.js`:
- `operationId` is generated at `onPointerDown` and reused across moves
- `onPointerMove` emits a preview event (with full points array) on first call
- `onPointerMove` does NOT emit again until 30 ms have elapsed
- Calling a cancel method emits `draw:stroke-cancel`

**Key design change** — `penTool.js` and `eraserTool.js` need to:
1. Generate `operationId` in `onPointerDown` (not `onPointerUp`)
2. Import and call `emitStrokePreview` inside `onPointerMove`
3. Import and call `emitStrokeCancel` in a new `onPointerCancel()` method
4. Use a `lastPreviewEmit` timestamp for the 30 ms guard

```javascript
// penTool.js sketch
let operationId = null;
let lastPreviewEmit = 0;

function onPointerDown(event, canvasEl) {
  drawing = true;
  points = [];
  operationId = crypto.randomUUID();
  lastPreviewEmit = 0;
  const v = toVirtual(event.offsetX, event.offsetY, canvasEl);
  points.push(v);
}

function onPointerMove(event, canvasEl, color, brushSize) {
  if (!drawing) return;
  const v = toVirtual(event.offsetX, event.offsetY, canvasEl);
  points.push(v);
  const now = Date.now();
  if (now - lastPreviewEmit >= 30) {
    emitStrokePreview(operationId, OP_TYPE.DRAW, [...points], color, brushSize);
    lastPreviewEmit = now;
  }
}

function onPointerCancel() {
  if (!drawing) return;
  drawing = false;
  emitStrokeCancel(operationId);
  operationId = null;
  points = [];
}
```

> **Note**: `color` and `brushSize` must now be passed to `onPointerMove` (not just `onPointerUp`). Update `Canvas.jsx` call sites accordingly.

---

### Step 4 — `useCanvas` hook (unit tests first)

**Write failing tests** in `client/tests/unit/useCanvas.test.js`:
- `previews` starts as empty Map
- `PREVIEW_BROADCAST` event adds/replaces entry in `previews`
- `PREVIEW_CANCEL` event removes entry from `previews`
- `DRAW_BROADCAST` (commit) removes any matching entry from `previews`
- `CANVAS_CLEARED` empties `previews`
- `previews` reference changes so renderer marks dirty

**Implement** in `useCanvas.js`:
```javascript
const [previews, setPreviews] = useState(new Map());

// On PREVIEW_BROADCAST:
setPreviews(prev => new Map(prev).set(op.operationId, op));

// On PREVIEW_CANCEL:
setPreviews(prev => { const m = new Map(prev); m.delete(op.operationId); return m; });

// On DRAW_BROADCAST (existing handler, extend):
setPreviews(prev => { const m = new Map(prev); m.delete(op.operationId); return m; });
addOperation(op);

// On CANVAS_CLEARED (existing handler, extend):
setPreviews(new Map());
addOperation(op);

return { operations, previews, addOperation, getVisibleOperations };
```

---

### Step 5 — `useCanvasRenderer` (unit tests first)

**Write failing tests** in `client/tests/unit/useCanvasRenderer.test.js`:
- Committed operations render without `globalAlpha` change
- Remote previews render with `ctx.globalAlpha = 0.6`
- Local preview renders with `ctx.globalAlpha = 1.0`
- Preview pass is drawn after committed operations (ordering)

**Implement** in `useCanvasRenderer.js`:

Add `previews` and `localPreview` parameters:
```javascript
export function useCanvasRenderer(canvasRef, operations, getVisibleOperations, previews, localPreview) {
```

In the render function, after rendering committed ops add two more passes:
```javascript
// Pass 2: remote previews (reduced opacity)
ctx.save();
ctx.globalAlpha = 0.6;
for (const preview of (previews?.values() ?? [])) {
  if (preview.type === OP_TYPE.DRAW) renderDraw(ctx, preview, canvas);
  else if (preview.type === OP_TYPE.ERASE) renderErase(ctx, preview, canvas);
}
ctx.restore();

// Pass 3: local in-progress stroke (full opacity)
if (localPreview) {
  if (localPreview.type === OP_TYPE.DRAW) renderDraw(ctx, localPreview, canvas);
  else if (localPreview.type === OP_TYPE.ERASE) renderErase(ctx, localPreview, canvas);
}
```

Mark dirty when `previews` reference changes:
```javascript
useEffect(() => { dirtyRef.current = true; }, [previews]);
```

---

### Step 6 — `Canvas.jsx` (component tests first)

**Write failing tests** in `client/tests/unit/Canvas.test.jsx` (or extend `useCanvas.test.js`):
- `onPointerLeave` calls tool cancel and emits cancel event
- `onPointerCancel` calls tool cancel and emits cancel event
- `setPointerCapture` is NOT called on pointer-down

**Implement** in `Canvas.jsx`:

1. Remove `canvas.setPointerCapture(e.pointerId)` from `handlePointerDown`.

2. Pass `color, brushSize` to `onPointerMove`:
```javascript
const handlePointerMove = useCallback((e) => {
  const canvas = canvasRef.current;
  if (activeTool === TOOL_NAMES.PEN)    penTool.onPointerMove(e.nativeEvent, canvas, color, brushSize);
  if (activeTool === TOOL_NAMES.ERASER) eraserTool.onPointerMove(e.nativeEvent, canvas);
}, [activeTool, color, brushSize]);
```

3. Add cancel handler (shared by `onPointerLeave` and `onPointerCancel`):
```javascript
const handlePointerCancel = useCallback(() => {
  if (activeTool === TOOL_NAMES.PEN)    penTool.onPointerCancel();
  if (activeTool === TOOL_NAMES.ERASER) eraserTool.onPointerCancel();
}, [activeTool]);
```

4. Thread `previews` and `localPreview` through to `useCanvasRenderer`:
```javascript
const { operations, previews, addOperation, getVisibleOperations } = useCanvas();
// localPreview is derived from tool state — expose via a ref or getter
useCanvasRenderer(canvasRef, operations, getVisibleOperations, previews, localPreview);
```

5. Register the cancel handler on the `<canvas>` element:
```jsx
onPointerLeave={handlePointerCancel}
onPointerCancel={handlePointerCancel}
```

---

### Step 7 — Server handlers (integration tests first)

**Write failing tests** in `server/tests/integration/drawHandlers.test.js`:
- `draw:stroke-preview` is relayed as `draw:preview-broadcast` to other room sockets
- `draw:stroke-preview` is NOT stored in `room.operations`
- `draw:stroke-cancel` is relayed as `draw:preview-cancel` to other room sockets
- Disconnecting a socket mid-preview triggers `draw:preview-cancel` to the room
- `draw:stroke` (commit) clears `session.activePreviewId`

**Implement** in `eventHandlers.js`:

```javascript
// ── draw:stroke-preview ─────────────────────────────────────────────────────
socket.on(EVENTS.DRAW_STROKE_PREVIEW, (payload) => {
  const session = sessions.get(socket.id);
  if (!session?.roomId) return;
  const { operationId, type, points, color, brushSize } = payload || {};
  if (!operationId || ![OP_TYPE.DRAW, OP_TYPE.ERASE].includes(type) || !Array.isArray(points) || points.length === 0) return;

  session.activePreviewId = operationId;
  socket.to(session.roomId).emit(SERVER_EVENTS.PREVIEW_BROADCAST, {
    operationId, type, userId: session.userId, points, color, brushSize,
  });
  logger.info({ event: EVENTS.DRAW_STROKE_PREVIEW, roomId: session.roomId, userId: session.userId, operationId });
});

// ── draw:stroke-cancel ──────────────────────────────────────────────────────
socket.on(EVENTS.DRAW_STROKE_CANCEL, (payload) => {
  const session = sessions.get(socket.id);
  if (!session?.roomId) return;
  const { operationId } = payload || {};
  if (!operationId) return;

  session.activePreviewId = null;
  socket.to(session.roomId).emit(SERVER_EVENTS.PREVIEW_CANCEL, {
    operationId, userId: session.userId,
  });
  logger.info({ event: EVENTS.DRAW_STROKE_CANCEL, roomId: session.roomId, userId: session.userId, operationId });
});
```

In the `draw:stroke` handler, add after validation:
```javascript
session.activePreviewId = null; // preview superseded by commit
```

In the `disconnect` handler, add before `sessions.delete`:
```javascript
if (session?.activePreviewId && session.roomId) {
  socket.to(session.roomId).emit(SERVER_EVENTS.PREVIEW_CANCEL, {
    operationId: session.activePreviewId,
    userId: session.userId,
  });
}
```

---

### Step 8 — E2E test

**Add scenarios** to `e2e/drawing.spec.js`:
- Single user: stroke appears incrementally while dragging (screenshot comparison)
- Two users: user B's canvas shows a stroke while user A is dragging (before mouse-up)
- After user A releases: user B's canvas shows the committed (full-opacity) stroke
- After user A leaves canvas mid-stroke: user B's in-progress preview disappears

---

## Verifying the Feature Locally

```bash
# Terminal 1 — start server
cd server && npm run dev

# Terminal 2 — start client
cd client && npm run dev

# Open http://localhost:5173 in two browser tabs
# Tab 1: Create a room, note the room ID
# Tab 2: Join that room
# Drag in Tab 1 — stroke should appear incrementally in Tab 2 at ~60% opacity
# Release in Tab 1 — stroke in Tab 2 becomes fully opaque
```

Run unit tests:
```bash
cd client && npm test
cd server && npm test
```

Run E2E tests:
```bash
cd e2e && npx playwright test drawing.spec.js
```

---

## Gotchas

- **`color` and `brushSize` in `onPointerMove`**: The tool signature changes. Update the `Canvas.jsx` call site and all related tests.
- **`operationId` generated at pointer-down (not pointer-up)**: Existing tests for `penTool.onPointerUp` will need updating since the UUID is now pre-assigned.
- **Local preview render source**: The local user's own in-progress stroke is NOT in `previews` (that Map is remote-only). It is passed as a separate `localPreview` prop to the renderer, derived from the tool's current `points` state.
- **Pointer capture removed**: This changes behaviour for fast mouse movements — strokes now end at the canvas boundary. E2E tests for edge drawing need to be aware of this.
- **`previews` is a `Map` in React state**: Use `new Map(prev)` to create a new reference on each mutation so React detects the change and `useEffect` dependencies trigger.
