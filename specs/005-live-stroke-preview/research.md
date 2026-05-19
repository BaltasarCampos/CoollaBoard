# Research: Live Stroke Preview

**Feature**: `005-live-stroke-preview`  
**Date**: 2026-05-18  
**Status**: Complete — all unknowns resolved

---

## 1. Overlay Canvas for Separated Rendering Layers

**Decision**: Two stacked `<canvas>` elements — one for committed operations (existing), one for in-progress previews (new, on top).

**Rationale**: FR-009 requires that preview rendering does not interfere with the committed operations layer. The cleanest isolation is a physically separate canvas element positioned absolutely over the main canvas, sharing the same dimensions. The preview canvas is cleared and repainted every RAF frame using only preview map data; the committed canvas is untouched. The overlay canvas carries `pointer-events: none` so all pointer events fall through to (and are captured by) the main canvas element.

**Alternatives considered**:  
- *Single canvas with z-ordered draw calls*: Preview strokes would be drawn after committed ops each frame. This requires replaying all committed ops every frame even when only previews change, increasing CPU load and creating a transient artifact risk at the preview→commit transition. Rejected.  
- *Off-screen canvas composited via `drawImage`*: Extra compositing step with no benefit over a DOM-stacked approach. Rejected.

---

## 2. operationId Generation Timing

**Decision**: Client generates a UUID (`crypto.randomUUID()`) at pointer-down — not at pointer-up as in the current implementation.

**Rationale**: The `operationId` must be the same for all preview events and the eventual commit event so that remote clients can correlate them (FR-007). Moving generation to pointer-down fulfills this and is consistent with the clarification in the spec (Session 2026-05-17).

**Alternatives considered**:  
- *Generate at pointer-up and embed in preview events retroactively*: Not possible — preview events are sent before pointer-up occurs.  
- *Server-assigned ID*: Would require a round-trip acknowledgement before any preview can be sent; adds latency and complicates the stateless relay constraint. Rejected.

---

## 3. Preview Event Throttle Strategy

**Decision**: `Date.now()`-based timestamp comparison inside the tool's `onPointerMove` handler. A `lastPreviewAt` variable tracks the last emission time; a new preview is emitted only if `Date.now() - lastPreviewAt >= 30`. Each emitted event carries the **full accumulated points array** to date so no path segments are lost due to the rate cap.

**Rationale**: FR-014 mandates ≤ 1 event per 30 ms. A simple timestamp gate is deterministic, has zero dependency overhead, and avoids timer-based approaches that can fire slightly after pointer-up (causing a spurious final preview event after the commit has already been sent).

**Alternatives considered**:  
- *`setInterval`-driven batch emission*: Stale interval could send a preview event after pointer-up. Requires careful cleanup on cancel/up events. Rejected.  
- *`requestAnimationFrame` gating*: Ties emission to frame rate (~16 ms), which is faster than required and adds coupling to the rendering cycle. Rejected.  
- *Lodash `throttle`*: Introduces a new package dependency; adds trailing-call risk. Rejected.

---

## 4. Pointer-Leave / Pointer-Enter Pause-Resume Semantics

**Decision**: On `pointerleave`, the tool sets an `insideCanvas` flag to `false` and stops appending points; the last emitted preview remains visible on all canvases. On `pointerenter`, the flag resets to `true` and point collection resumes. On `pointerup` (delivered always due to pointer capture set at pointer-down), the stroke commits with all points accumulated before the pointer left the canvas bounds.

**Rationale**: FR-008 specifies this exact behavior. Pointer capture (`canvas.setPointerCapture(e.pointerId)`) from pointer-down guarantees that `pointerup` is delivered to the canvas element even when the pointer is outside its bounds at release. This is already wired in the current `Canvas.jsx` implementation (`canvas.setPointerCapture(e.pointerId)` in `handlePointerDown`).

**Alternatives considered**:  
- *Commit on pointer-leave*: Would produce many unintended commits whenever the pointer briefly leaves the canvas. Rejected.  
- *Cancel on pointer-leave*: Loses in-progress stroke points if user returns. Rejected.

---

## 5. Disconnect → Orphaned Preview Cleanup

**Decision**: On socket `disconnect`, the server emits a new `user:left` event to the room (via `socket.to(roomId).emit(SERVER_EVENTS.USER_LEFT, { userId })`) before removing the session. Clients listen for this event in `usePreviewLayer` and call `clearAllPreviews` for that `userId`, removing all preview registry entries keyed to that user.

**Rationale**: SC-005 requires orphaned previews to be removed within 5 s of disconnection. The server already handles disconnect cleanup (removing user from room); broadcasting `user:left` adds a single `socket.to().emit()` call. Client response is instantaneous. No server-side preview caching needed.

**Alternatives considered**:  
- *Client-side TTL (stale preview timeout)*: Client would need wall-clock timers per preview; if network is slow the preview might timeout prematurely. Complex and unreliable. Rejected.  
- *Server-side TTL for preview entries*: Contradicts the stateless relay constraint (FR-003, FR-006). Rejected.  
- *Reuse existing `room:state` re-hydration on reconnect*: Does not help remote clients who are still connected; they need a push signal. Rejected.

---

## 6. Server-Side userId Validation

**Decision**: For each incoming `stroke:preview` or `stroke:cancel` event, the server looks up `sessions.get(socket.id).userId` and compares it to the `userId` field in the payload. If they differ, the event is dropped silently and a `warning`-level log entry is emitted (FR-016, FR-017).

**Rationale**: Prevents a compromised client from broadcasting preview events under a different user's identity. The validation is a single map lookup with no performance impact.

**Alternatives considered**:  
- *Trust the payload userId*: Opens spoofing surface where any client can emit previews attributed to any userId. Rejected.  
- *Strip payload userId and replace with session userId*: Equivalent protection; however dropping and logging is preferred by the spec to avoid silent mutation. Rejected.

---

## 7. Local Preview Rendering in Canvas Component

**Decision**: The local in-progress stroke (before commit) is maintained as a single `localPreview` ref in `Canvas.jsx`. On each `onPointerMove`, the current tool returns the latest `{ operationId, type, points, color, brushSize }` snapshot; the Canvas calls `setPreview` on `usePreviewLayer` with this data. The preview hook merges it into the shared `previews` map, which the renderer uses for the overlay canvas.

**Rationale**: Reusing the same `previews` map for both local and remote in-progress strokes simplifies the renderer — it iterates one map without distinguishing origin. The local preview entry is removed when the commit fires (pointer-up) or the stroke is cancelled, exactly as remote entries are removed.

**Alternatives considered**:  
- *Separate local-preview state path*: Would require the renderer to check two data structures. Rejected.  
- *Re-render the main canvas every pointer-move with the in-progress points appended*: Redraws all committed ops on every move event, which is expensive and violates FR-009's separation requirement. Rejected.

---

## 8. canvas:cleared Interaction with Previews

**Decision**: When the `canvas:cleared` event is received (both locally and remotely), `useCanvas` already adds the CLEAR op to the operations array. Additionally, `Canvas.jsx` calls `clearAllPreviews()` from `usePreviewLayer` at the same point, wiping the preview overlay canvas. FR-013 is satisfied without changes to `useCanvas` internals.

**Rationale**: The canvas clear is a committed operation that resets visual state. Preview entries from any user at or before the clear are stale and must be discarded.

**Alternatives considered**:  
- *Pass clearAllPreviews into useCanvas and call it there*: Creates a dependency from the data hook to the preview hook. Rejected in favour of co-locating both calls in Canvas.jsx which owns both hooks.

---

## Summary Table

| # | Unknown / Decision Point | Resolution |
|---|--------------------------|------------|
| 1 | How to separate preview and committed rendering | Two stacked canvas elements; preview canvas with `pointer-events: none` |
| 2 | When to generate operationId | At pointer-down (`crypto.randomUUID()`) |
| 3 | Preview event throttle mechanism | `Date.now()` timestamp gate, 30 ms minimum interval |
| 4 | Pointer-leave / pointer-enter semantics | Pause/resume via `insideCanvas` flag; pointer capture ensures pointer-up delivery |
| 5 | Orphaned preview cleanup on disconnect | Server emits `user:left`; clients clear preview registry for that userId |
| 6 | Server userId validation | Compare `payload.userId` vs `sessions.get(socket.id).userId`; drop + warn on mismatch |
| 7 | How local preview enters the render pipeline | Tool returns snapshot on pointer-move; Canvas calls `setPreview`; shared previews map |
| 8 | canvas:cleared interaction | Canvas.jsx calls `clearAllPreviews()` alongside the existing clear-op handling |
