# Quickstart: Live Stroke Preview

**Feature**: `005-live-stroke-preview`  
**Date**: 2026-05-18

This guide covers what changes, how they fit together, and how to run/test the feature end-to-end.

---

## What Changed

| Layer | File(s) | Change |
|-------|---------|--------|
| Shared constants | `shared/constants.js` | 5 new event name constants |
| Socket service | `client/src/services/socket.js` | 2 new emit helpers |
| Pen tool | `client/src/tools/penTool.js` | operationId at down; throttled preview; cancel/leave/enter |
| Eraser tool | `client/src/tools/eraserTool.js` | Same as pen tool |
| Preview hook | `client/src/hooks/usePreviewLayer.js` | **New** — manages PreviewRegistry |
| Canvas renderer | `client/src/hooks/useCanvasRenderer.js` | Accepts previewCanvasRef + previews |
| Canvas component | `client/src/components/Canvas.jsx` | Overlay `<canvas>`; pointer-cancel/leave/enter handlers |
| Server handlers | `server/src/handlers/eventHandlers.js` | stroke:preview, stroke:cancel handlers; user:left on disconnect |

---

## Architecture at a Glance

```
Drawing user's browser                     Remote user's browser
─────────────────────                      ─────────────────────
pointer-down
  └─ tool: generate operationId
  └─ tool: record first point

pointer-move (×N, throttled)
  └─ tool: accumulate point
  └─ tool: emitStrokePreview()  ───────►  Server (stateless relay)
  └─ Canvas: setPreview(local)             └─ validate userId
                                           └─ emit stroke:preview:broadcast  ───►  usePreviewLayer.setPreview()
                                                                                    └─ previews Map updated
Preview canvas (RAF loop)                                                           Preview canvas (RAF loop)
  └─ renders local preview                                                            └─ renders remote preview

pointer-up
  └─ tool: emitStroke() commit  ──────►  Server (persists + broadcasts)
  └─ tool: removePreview()               └─ emit draw:broadcast  ──────────────►  usePreviewLayer.removePreview()
  └─ addOperation() (committed)                                                     └─ addOperation() (committed)
```

---

## Key Concepts

### Two-Canvas Stack

`Canvas.jsx` renders two `<canvas>` elements inside a shared container (CSS `position: relative`):

1. **Main canvas** (bottom) — renders committed operations via `useCanvasRenderer` (unchanged)
2. **Preview canvas** (top) — renders in-progress previews; `pointer-events: none` so pointer events fall through

```jsx
<div style={{ position: 'relative', width: '100%', height: '100%' }}>
  <canvas ref={canvasRef} ... />
  <canvas ref={previewCanvasRef} style={{ position: 'absolute', top: 0, left: 0,
                                           pointerEvents: 'none', width: '100%', height: '100%' }} />
</div>
```

### PreviewRegistry

`usePreviewLayer` maintains a `Map<operationId, StrokePreview>`. Both local (self) and remote (other users) in-progress strokes live in the same map. The preview canvas iterates this map on every dirty frame.

### operationId Lifecycle

```
pointer-down   → operationId = crypto.randomUUID()    (stored in tool state)
pointer-move   → operationId included in each stroke:preview payload
pointer-up     → same operationId used in draw:stroke commit; preview removed
pointer-cancel → same operationId used in stroke:cancel; preview removed
```

### Throttle

Each tool tracks `lastPreviewAt` (timestamp). `onPointerMove` only calls `emitStrokePreview` when `Date.now() - lastPreviewAt >= 30`. Every emission carries the **full accumulated points array**; no intermediate points are dropped.

---

## Running the App

```bash
# From repo root — start server
cd server && npm start

# In a second terminal — start client dev server
cd client && npm run dev
```

Open `http://localhost:5173` in two browser tabs, join the same room, and draw in one tab — you should see the stroke appear live in the other tab as you move the pointer.

---

## Running Tests

```bash
# Client unit tests (Vitest)
cd client && npm test

# Server integration tests (Jest)
cd server && npm test

# E2E tests (Playwright) — requires both server and client running
cd e2e && npm test
```

### New / updated test files

| File | Coverage |
|------|---------|
| `client/tests/unit/usePreviewLayer.test.js` | Preview CRUD, socket subscriptions, clear on user:left, clear on canvas:cleared |
| `client/tests/unit/penTool.test.js` | operationId at pointer-down; throttled preview emission; cancel/leave/enter state |
| `client/tests/unit/eraserTool.test.js` | Same as penTool |
| `client/tests/unit/useCanvasRenderer.test.js` | Preview layer rendering; preview removed on commit arrival |
| `server/tests/integration/drawHandlers.test.js` | stroke:preview relay; userId mismatch drop + warn log; stroke:cancel relay; user:left on disconnect |

---

## Important Edge Cases

| Edge case | Behaviour |
|-----------|-----------|
| Very fast stroke (pointer-up before throttle fires) | Commit event emitted immediately; clients display committed stroke; no double-render because preview was never set |
| Preview event arrives after commit for same operationId | Client checks: if `operationId` is no longer in PreviewRegistry (already committed), preview event is ignored |
| canvas:cleared while previewing | `clearAllPreviews()` called on every client; preview overlay is blank on next frame |
| Pointer leaves canvas mid-stroke | Point collection paused; preview remains; collection resumes on pointer-enter; commit normal on pointer-up |
| User disconnects mid-stroke | Server emits `user:left`; remote clients remove all previews for that userId within one socket message round-trip |
| Multiple concurrent previews | PreviewRegistry holds one entry per operationId; each user's active stroke has its own entry; all rendered simultaneously |

---

## Sequence of Implementation (for /speckit.tasks)

1. Update `shared/constants.js` — add new event name constants
2. Update `client/src/services/socket.js` — add `emitStrokePreview`, `emitStrokeCancel`
3. Update `client/src/tools/penTool.js` — operationId at down; preview emission; cancel/leave/enter
4. Update `client/src/tools/eraserTool.js` — same changes
5. Create `client/src/hooks/usePreviewLayer.js` — PreviewRegistry hook
6. Update `client/src/hooks/useCanvasRenderer.js` — preview canvas rendering
7. Update `client/src/components/Canvas.jsx` — overlay canvas; pointer-cancel/leave/enter; wire preview layer
8. Update `server/src/handlers/eventHandlers.js` — stroke:preview, stroke:cancel; user:left on disconnect
9. Write/update test files (TDD: tests first, then code)
10. Manual E2E smoke test in two tabs
