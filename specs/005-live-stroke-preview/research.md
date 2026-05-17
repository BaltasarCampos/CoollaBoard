# Research: Live Stroke Preview

**Feature**: 005-live-stroke-preview  
**Date**: 2026-05-17  
**Status**: Complete — no NEEDS CLARIFICATION items remain

---

## Research Topic 1: Preview Rendering Strategy — Overlay Canvas vs. Same-Canvas Second Pass

**Question**: Should in-progress preview strokes be rendered on a separate HTML canvas overlaid on top of the committed-operations canvas, or as an additional rendering pass on the existing single canvas element?

**Decision**: Same-canvas second rendering pass

**Rationale**:
The current architecture uses a single `<canvas>` element with a `requestAnimationFrame` render loop driven by a dirty flag (`dirtyRef`). All committed operations are re-drawn from scratch on each dirty frame via `getVisibleOperations()`. Adding previews as a second pass inside the same render cycle is the minimal-change approach:
- No new DOM elements or React refs
- No need to synchronise two canvases' resize/DPI behaviour
- Preview opacity is controlled by setting `ctx.globalAlpha` before the preview rendering pass and restoring it after — one line change per preview stroke
- The dirty flag already fires at 30 ms intervals (matching the preview throttle) so no change to the render loop cadence is needed

The separate-overlay approach would require a second `<canvas>` positioned absolutely, a second `ResizeObserver`, forwarding pointer events through an overlay to the underlying canvas, and a second render loop. This is disproportionate complexity for a read-only rendering pass.

**Alternatives considered**:
- **Separate overlay canvas**: Rejected — adds DOM complexity, resize synchronisation, and event-forwarding logic with no rendering quality benefit.
- **CSS `opacity` on new SVG strokes**: Rejected — SVG in-progress paths would diverge from the Canvas-API rendering model used for committed operations, creating visual inconsistency.

---

## Research Topic 2: Preview Event Throttle — Implementation Pattern

**Question**: How should the 30 ms emit throttle (FR-015) be implemented in tool modules (`penTool.js`, `eraserTool.js`)?

**Decision**: Leading-edge timestamp throttle using `Date.now()` comparison

**Rationale**:
Each tool module already maintains an internal `drawing` boolean and a `points` array as plain module-level state. Adding a `lastPreviewEmit` timestamp variable alongside these is zero external dependency. The implementation:

```javascript
// Inside onPointerMove:
const now = Date.now();
if (now - lastPreviewEmit >= 30) {
  emitStrokePreview(operationId, type, [...points], color, brushSize);
  lastPreviewEmit = now;
}
```

This is a **leading-edge throttle**: the first move fires immediately (when `lastPreviewEmit = 0`), and then at most once per 30 ms thereafter. The emitted payload always carries the **full accumulated points array** so no intermediate points are lost if a frame is skipped — the next emission corrects the remote view.

**Alternatives considered**:
- **`setInterval` in `onPointerDown`**: Would require interval teardown in `onPointerUp`/`onPointerCancel` — more lifecycle management. Leading-edge timestamp is simpler.
- **requestAnimationFrame-based throttle**: Ties preview emission to the render loop (60 fps) rather than the spec-required 30 ms cadence. Over-specifies behaviour and couples network I/O to render timing.
- **Trailing-edge throttle**: Emits after 30 ms of inactivity — bad for drawing UX, as the remote view would lag continuously.

---

## Research Topic 3: Pointer-Leave / Pointer-Cancel — Pointer Capture Conflict

**Question**: The spec requires a stroke to be cancelled when the pointer leaves the canvas bounds (FR-009, clarification Q1). The current `Canvas.jsx` calls `canvas.setPointerCapture(e.pointerId)` on pointer-down, which suppresses `pointerleave` events during a stroke. How should these be reconciled?

**Decision**: Remove `setPointerCapture`; handle `onPointerLeave` (as cancel) and `onPointerCancel` (as cancel)

**Rationale**:
`setPointerCapture` was added to ensure `pointermove` events continue arriving when the pointer drifts outside the element boundaries. Without it, fast mouse movements cause missed points at the canvas edge. However:

1. The spec explicitly chose "cancel on leave" (clarification Q1 — Option A). Keeping pointer capture silently overrides this spec decision.
2. For the intended use case (desktop browser, mouse), removing capture still delivers good point density up to the canvas boundary, and the boundary itself acts as the natural stroke end.
3. `onPointerCancel` must still be added regardless (no capture → system interrupts still fire `pointercancel`).
4. Touch behaviour: on mobile (out-of-scope per spec assumptions), `pointercancel` handles the gesture-steal case. Removing capture does not break touch strokes on devices that honour the spec's pointer events model.

The `onPointerLeave` handler in `Canvas.jsx` calls the same cancel path as `onPointerCancel`: emits `draw:stroke-cancel` and clears local state.

**Alternatives considered**:
- **Keep `setPointerCapture`, add programmatic boundary check**: On each `pointermove`, check if the virtual coordinates are outside the canvas bounds and treat that as a leave. Rejected — fragile and duplicates what `onPointerLeave` already provides natively.
- **Keep `setPointerCapture`, listen for `pointerleave` on the document**: Would fire when the pointer leaves the browser window, not the canvas. Not equivalent to the spec requirement.

---

## Research Topic 4: Server-Side Preview Relay — Session Registry for Disconnect Cleanup

**Question**: The server is a stateless relay for preview events (FR-003). However, Principle VIII (Resilience) and FR-009 require that in-progress previews from a disconnected user be cleared. How can the server broadcast a `draw:preview-cancel` on disconnect if it doesn't persist previews?

**Decision**: Track active `operationId` per socket session in `eventHandlers.js` — lightweight, not in `roomService`

**Rationale**:
The server does not need to store preview *content* (points, color, brushSize). It only needs to know, per socket, the `operationId` of any currently in-flight preview, so it can emit a `draw:preview-cancel` on disconnect. This is a single string per session stored in the existing `sessions` Map:

```javascript
// sessions entry: { userId, roomId, activePreviewId: string | null }
```

On `draw:stroke-preview`: set `session.activePreviewId = operationId`  
On `draw:stroke-cancel` or `draw:stroke-commit` (`draw:stroke`): clear `session.activePreviewId = null`  
On `disconnect`: if `session.activePreviewId` is set, emit `draw:preview-cancel` to the room

This keeps preview state minimal on the server (one nullable string per connected socket) and keeps `roomService.js` free of ephemeral data — satisfying both FR-007 and Principle VI.

**Alternatives considered**:
- **No disconnect cleanup**: Leaves orphaned previews on all remote canvases until the next draw event. Violates SC-005 and FR-009.
- **Room-level preview registry in `roomService.js`**: Overkill — persisting even a lightweight preview registry in the room service violates FR-007's spirit and grows `roomService`'s responsibility scope.
