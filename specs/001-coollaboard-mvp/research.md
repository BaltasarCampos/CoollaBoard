# Research: CoollaBoard MVP

**Phase**: 0 — Outline & Research  
**Date**: 2026-05-14  
**Plan**: [plan.md](plan.md)

All NEEDS CLARIFICATION items from the Technical Context are resolved below.

---

## 1. Testing Framework Selection

**Decision**: Vitest + React Testing Library (frontend) · Jest (backend) · Playwright (E2E)

**Rationale**:
- **Vitest** integrates natively with Vite (the chosen frontend build tool), shares the same config, and handles ES modules without transformation overhead. It supports `jsdom` for DOM/Canvas API mocking. API is Jest-compatible, so developers familiar with Jest incur zero learning cost.
- **React Testing Library (RTL)** encourages testing components from the user's perspective (fire events, query DOM) rather than implementation details. Pairs naturally with Vitest.
- **Jest** is the dominant standard for Node.js backend testing. It has mature support for `socket.io-mock` and `supertest`, and no bundler integration is needed server-side.
- **Playwright** is the only E2E framework with first-class multi-tab/multi-browser-context support, which is essential for testing SC-003 (live stroke sync across tabs) and SC-005 (≥5 concurrent users). It supports chromium, firefox, and webkit.

**Alternatives considered**:
- *Jest for frontend*: Extra config needed to handle Vite's ES module output; slower than Vitest for large component suites. Rejected.
- *Cypress*: Does not natively support multiple simultaneous browser contexts in one test — requires workarounds. Rejected for E2E.
- *Vitest for backend*: Unnecessary; Vite dependency is frontend-only. Rejected.

---

## 2. UUID Generation Without Additional Dependencies

**Decision**: `crypto.randomUUID()` — native in both Node.js 14.17+ and browsers (Chrome 92+, Firefox 95+, Edge 92+).

**Rationale**: No npm package (e.g., `uuid`) is needed. `crypto.randomUUID()` generates RFC 4122 v4 UUIDs, is cryptographically random, and is available in all target runtimes. Calling it from `shared/constants.js` helper functions keeps generation consistent across client and server.

**Alternatives considered**:
- *`uuid` npm package*: Adds a dependency for something the platform already provides. Rejected.
- *Short IDs (nanoid)*: Not needed; `operationId` is internal and never displayed to users. Rejected.

---

## 3. Room ID Generation

**Decision**: Server generates a 6-character string from the alphabet `A–Z0–9` using `crypto.getRandomValues()` (browser) / `crypto.randomBytes()` (Node.js).

**Rationale**: ~2.18 billion combinations (36^6) make collision negligible at MVP scale. IDs are generated server-side on `room:create` to avoid client-spoofed IDs. Uppercase-only keeps sharing easy.

**Alternatives considered**:
- *UUID-based IDs*: Too long for manual sharing. Rejected.
- *Sequential numeric IDs*: Enumerable — a security concern even for a non-auth MVP. Rejected.

---

## 4. Canvas Rendering Architecture

**Decision**: Single `<canvas>` element with full redraw on each `requestAnimationFrame` frame when the operations log changes (dirty-flag pattern). Canvas state is mirrored in a React ref (`useRef`) — not in React state — to avoid reconciler overhead during drawing.

**Rationale**:
- Single canvas is simpler than a layered approach and sufficient for MVP stroke counts.
- Keeping the operation log in a ref rather than React state prevents unnecessary re-renders on each `pointermove` event (which fires at ~60 fps).
- Dirty-flag (`needsRedraw` ref) ensures the canvas is only repainted when the log changes, not every animation frame.

**Hydration performance (SC-007)**: 500 operations represented as arrays of `{x, y}` points. Replaying 500 paths using `CanvasRenderingContext2D.beginPath() / moveTo / lineTo / stroke` takes < 50 ms on modern hardware, well within the 3 s budget.

**Alternatives considered**:
- *Two-canvas overlay (draw layer + static layer)*: Useful for cursor/preview overlays, but out of scope for MVP. Deferred.
- *React state for canvas content*: Each `pointermove` would trigger a reconciler diff. Rejected for performance.

---

## 5. Virtual Coordinate Space and Scaling

**Decision**: All drawing operations store coordinates in the fixed 1920×1080 virtual space. At render time, `client/src/utils/coordinates.js` computes a scale factor and letterbox offsets based on the physical canvas element size.

```
scaleX = canvasElement.width / VIRTUAL_WIDTH   // VIRTUAL_WIDTH = 1920
scaleY = canvasElement.height / VIRTUAL_HEIGHT  // VIRTUAL_HEIGHT = 1080
scale  = min(scaleX, scaleY)                   // uniform scale (letterbox)
offsetX = (canvasElement.width  - VIRTUAL_WIDTH  * scale) / 2
offsetY = (canvasElement.height - VIRTUAL_HEIGHT * scale) / 2

// Virtual → Screen
screenX = virtualX * scale + offsetX
screenY = virtualY * scale + offsetY

// Screen → Virtual (pointer input)
virtualX = (screenX - offsetX) / scale
virtualY = (screenY - offsetY) / scale
```

**Rationale**: Ensures all users see identical relative drawing positions regardless of viewport size. Letterboxing (rather than stretching) keeps aspect ratio correct.

**Alternatives considered**:
- *Percentage-based coordinates*: Equivalent but less intuitive for fixed-radius constants (eraser = 20 units). Rejected.
- *Per-client coordinate systems*: No shared reference; strokes appear in different positions on different screens. Rejected.

---

## 6. Socket.IO Event Design for Idempotency and Ordering

**Decision**: Each drawing operation has an `operationId` (UUID v4) generated client-side before emit. The server assigns a per-room monotonically increasing `sequenceNumber` before broadcasting. On reconnect, the client sends its last known `sequenceNumber` so the server can replay only missed operations (delta hydration).

**Why client-generated operationId**: Allows the client to optimistically render its own strokes immediately (local echo) without waiting for server roundtrip, while the server deduplicates retransmissions using the ID.

**Ordering**: Server is the single source of truth for ordering (Principle V). Clients replay the operation log in `sequenceNumber` order when hydrating.

**Alternatives considered**:
- *Server-generated operationId*: Requires a roundtrip before local rendering; breaks optimistic UI. Rejected.
- *Timestamp-based ordering*: Client clocks diverge; not reliable for convergence. Rejected.

---

## 7. Reconnection Strategy

**Decision**: Socket.IO client built-in reconnection with exponential backoff (default: initial delay 1 s, multiplier 2×, max delay 30 s, unlimited retries). On `connect` event after a disconnect, the client re-emits `room:join` to re-hydrate state from the server.

**Rationale**: Socket.IO's built-in reconnection handles the backoff automatically when `reconnection: true` (the default). The `connect` event fires on both initial connection and successful reconnection, so a single handler covers both paths.

**Room expiry handling (FR-017)**: If the server responds to `room:join` with `{ error: 'ROOM_NOT_FOUND' }`, the client redirects to the homepage with a "room no longer exists" message.

**Alternatives considered**:
- *Manual WebSocket with custom backoff*: More code, no benefit for MVP. Rejected.

---

## 8. Room Lifecycle and TTL Eviction

**Decision**: When the last socket in a room disconnects, the server starts a grace-period timer (`setTimeout`) of 45 seconds (midpoint of the 30–60 s spec range). If no socket reconnects to the room within that window, `roomService.js` deletes the room from the `Map`. If a socket joins before the timer fires, the timer is cancelled.

**Rationale**: 45 s is long enough to survive a browser refresh (typically < 5 s reconnect cycle) but short enough to keep memory clean in a demo/MVP context. The logic lives entirely in `roomService.js` (single responsibility).

**Alternatives considered**:
- *30 s*: May be too tight on slow networks. Rejected.
- *60 s*: Acceptable, but 45 s is a reasonable midpoint with no functional difference. Selected 45 s.
- *setInterval-based sweep*: More complex, unnecessary for small MVPs. Rejected.

---

## 9. Area-Based Erasure

**Decision**: The eraser tool does not produce a `DRAW` operation with `destination-out` compositing. Instead, it produces an `ERASE` operation — a path of `{x, y}` points — that is replayed at render time by drawing a filled circle (radius 20 virtual units) at each point along the path using `destination-out` globalCompositeOperation.

**Rationale**:
- Storing erase strokes as operations (not bitmap diffs) keeps the log compact and replayable.
- `destination-out` on a canvas with `alpha: true` clears the overlapping pixels.
- Render-time erasure ensures all clients converge to identical visual output from the same operation log.

**Canvas setup**: The canvas element must use a solid background (white) either via CSS or drawn as a filled rect at the start of each redraw, because `destination-out` makes pixels transparent — transparent pixels will show the page background without a solid base.

**Alternatives considered**:
- *White-filled circle (paint over)*: Fails when the background is not pure white (e.g., dark mode). Rejected in favour of `destination-out`.
- *Storing bitmaps*: Enormous memory cost; not replayable. Rejected.

---

## 10. Eraser Radius as a Shared Constant

**Decision**: `ERASER_RADIUS = 20` is defined in `shared/constants.js` and imported by both `client/src/tools/eraserTool.js` (for rendering and hit area) and any server-side validation if needed. It is **not** stored in the `DrawingOperation` payload.

**Rationale**: Per the spec Assumptions — "The eraser has a fixed radius of 20 virtual canvas units for the MVP; this is a shared constant and is not a per-operation field." Keeping it in `shared/constants.js` ensures client and server always agree on the value without transmitting it per-operation.

---

## 11. Clear Canvas Concurrent Execution

**Decision**: `clear` is stored as an operation type in the room log. It carries an `operationId` for deduplication. When replaying, all `DRAW` and `ERASE` operations with a `sequenceNumber` ≤ the `clear` operation's `sequenceNumber` are treated as cleared; only operations after the latest `clear` are rendered.

**Rationale**: This approach is idempotent (applying the same `clear` twice has the same result) and convergent (all clients replaying the same ordered log arrive at the same state). No special case handling needed for simultaneous clears — the higher-sequence-number clear simply becomes the effective reset point.

**Alternatives considered**:
- *Truncating the operation log on clear*: Simpler, but prevents future undo/redo. Rejected (even though undo is out of scope, keeping the log intact is lower-risk for future iterations).

---

## Summary: All Clarifications Resolved

| Item | Resolution |
|------|-----------|
| Testing frameworks | Vitest + RTL (frontend), Jest (backend), Playwright (E2E) |
| UUID generation | Native `crypto.randomUUID()` |
| Room ID generation | Server-side, 6-char A–Z0–9 via `crypto.randomBytes()` |
| Canvas rendering | Single canvas, ref-based state, dirty-flag redraw |
| Coordinate scaling | Letterbox scale from 1920×1080 virtual space |
| Event idempotency | Client `operationId` + server `sequenceNumber` |
| Reconnection | Socket.IO built-in backoff + re-join on `connect` |
| Room TTL | 45 s grace period via `setTimeout` in `roomService.js` |
| Area erasure | `destination-out` compositing, replayed from operation log |
| Eraser radius | Shared constant in `shared/constants.js`, not per-operation |
| Concurrent clear | `clear` stored as operation; replay filters by sequence after last clear |
