# Quickstart: Color Picker and Brush Size Controls

**Phase**: 1 — Design  
**Date**: 2026-05-16  
**Branch**: `004-color-brush-controls`  
**Plan**: [plan.md](plan.md)

---

## Prerequisites

- Node.js ≥ 20, npm ≥ 10
- Dependencies installed for all packages: `npm install` from repo root (or run per-package)

```bash
cd /path/to/CoollaBoard
npm install          # root (if workspace hoisting is configured)
cd client && npm install
cd ../server && npm install
cd ../e2e    && npm install
```

---

## Running the Application

Start the Socket.IO server and Vite dev server in separate terminals:

```bash
# Terminal 1 — server
cd server && npm start

# Terminal 2 — client
cd client && npm run dev
```

Open `http://localhost:5173` in your browser.

---

## Verifying the Feature Manually

1. Open the app in two browser tabs (same machine is fine).
2. In Tab 1: click **Create Room**. Note the 6-character room ID displayed.
3. In Tab 2: enter that room ID and click **Join Room**.
4. In Tab 1: click a **color swatch** in the toolbar (e.g., blue `#3b82f6`). Draw a stroke on the canvas.
5. Verify Tab 2 renders the same stroke in blue.
6. In Tab 1: click the **L** (large) brush size button. Draw another stroke.
7. Verify both tabs show a visibly wider stroke.
8. Switch Tab 1 to the **Eraser** tool, erase something, then switch back to **Pen**.
9. Verify the color and brush size are still set to the values from step 4/6 (not reset to defaults).

---

## Running Client Unit Tests

```bash
cd client
npm test
```

Key test files for this feature:

| File | What it covers |
|------|----------------|
| `tests/unit/penTool.test.js` | `emitStroke` called with color+brushSize; returned op has those fields |
| `tests/unit/useCanvasRenderer.test.js` | Per-op color+brushSize used for rendering; fallback to defaults when absent |
| `tests/unit/Toolbar.test.jsx` | Color swatch rendering, click → `onColorChange`; size buttons, click → `onBrushSizeChange` |

---

## Running Server Integration Tests

```bash
cd server
npm test
```

Key test file: `tests/integration/drawHandlers.test.js` — verifies `color` and `brushSize` are stored in room operations and included in rebroadcast.

---

## Running E2E Tests

```bash
# Requires both server and client running on default ports first
cd e2e
npm test
```

The existing drawing E2E tests in `drawing.spec.js` cover the stroke flow end-to-end; they pass as long as the server is running and strokes appear on both clients.

---

## Key Files Changed by This Feature

| File | Change Type | Summary |
|------|-------------|---------|
| `shared/constants.js` | Modified | Add `STROKE_PALETTE`, `BRUSH_PRESETS`, `DEFAULT_STROKE_COLOR`, `DEFAULT_BRUSH_WIDTH`; rename `STROKE_COLOR` |
| `client/src/services/socket.js` | Modified | `emitStroke` accepts + forwards `color`, `brushSize` |
| `client/src/tools/penTool.js` | Modified | `onPointerUp` accepts + embeds `color`, `brushSize` |
| `client/src/components/Toolbar.jsx` | Modified | Color swatch picker + brush size buttons added |
| `client/src/components/Canvas.jsx` | Modified | Receives + passes `color`, `brushSize` to pen tool |
| `client/src/components/RoomPage.jsx` | Modified | Holds `color`/`brushSize` state; passes to Toolbar + Canvas |
| `client/src/hooks/useCanvasRenderer.js` | Modified | `renderDraw` reads per-op `color`/`brushSize` with fallbacks |
| `server/src/handlers/eventHandlers.js` | Modified | Extracts + passes `color`/`brushSize` through to `addOperation` |
| `server/src/services/roomService.js` | Modified | `addOperation` includes `color`/`brushSize` in stored `fullOp` |

---

## Troubleshooting

**Strokes not showing the selected color**  
Check that `Toolbar.jsx` is calling `onColorChange` with the hex string and that `RoomPage.jsx` is passing `color` to `Canvas.jsx`. Verify `penTool.onPointerUp` is receiving the correct `color` argument.

**All strokes rendering in `#111111` regardless of selection**  
Most likely `color` is `undefined` when passed to `penTool.onPointerUp`. Add a `console.log` in `handlePointerUp` in `Canvas.jsx` to confirm the prop value.

**Server not storing color/brushSize**  
Check `eventHandlers.js` — ensure `color` and `brushSize` are destructured from `payload` and passed into the `addOperation` call. Check `roomService.js` to confirm they appear in `fullOp`.

**Tests failing with "emitStroke called with 3 arguments"**  
Tests written before this feature expected the old 3-argument signature. Those tests must be updated as part of the red-phase step (update tests first, then implement).
