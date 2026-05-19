# Implementation Plan: Live Stroke Preview

**Branch**: `005-live-stroke-preview` | **Date**: 2026-05-18 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `specs/005-live-stroke-preview/spec.md`

## Summary

Extend the drawing pipeline to emit transient `stroke:preview` events during pointer-move (throttled to ≤ 1 per 30 ms) so each drawing user sees their stroke rendered incrementally on their own canvas, and all other room participants see it in real time via broadcast. The server acts as a stateless relay — it validates the sender's `userId`, forwards preview events to room participants, and discards them without persisting. When a stroke commits (pointer-up) the existing `draw:stroke` path takes over; all canvases replace the preview with the committed operation. A new overlay canvas element (rendered above committed content) is used exclusively for preview rendering, satisfying the no-interference constraint. Each in-progress stroke is identified by a UUID generated on pointer-down, correlating preview and commit events throughout the stroke lifecycle.

## Technical Context

**Language/Version**: JavaScript (ES2022 modules), React 18.3, JSX  
**Primary Dependencies**: React 18, Vite 5, Vitest 1, @testing-library/react 16, socket.io-client 4, socket.io 4 (Node.js 20+)  
**Storage**: In-memory server state; preview events are NOT persisted — server is a stateless relay  
**Testing**: Vitest + @testing-library/react + jsdom (client unit); Jest + socket.io-client (server integration); Playwright (E2E)  
**Target Platform**: Modern desktop browser (Chrome/Firefox/Edge); Pointer Events API required  
**Project Type**: React SPA (`client/`) + Node.js Socket.IO server (`server/`), multi-package monorepo  
**Performance Goals**: Local preview renders within one pointer-move event (~16 ms per frame); remote preview arrives within ~200 ms under < 50 ms RTT; preview canvas clear-to-redraw stays < 16 ms  
**Constraints**: No new npm packages; preview events throttled to ≤ 1 per 30 ms per stroke; server does not cache or replay previews; overlay canvas uses CSS `position: absolute` with `pointer-events: none`  
**Scale/Scope**: 5 new or modified source files in `client/`, 2 in `server/`, 1 in `shared/`; 1 new hook; new test files for preview hook and integration flow

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| **I. Test-First (TDD)** | ✅ PASS | All new/modified units get failing tests before implementation: `usePreviewLayer`, `penTool`, `eraserTool`, `useCanvasRenderer`, preview event handlers on server. |
| **II. Modularity** | ✅ PASS | Preview state management extracted to a new `usePreviewLayer` hook with a single responsibility. Preview canvas rendering isolated from committed canvas rendering. Tools remain self-contained. |
| **III. Event-Driven** | ✅ PASS | Two new client→server events (`stroke:preview`, `stroke:cancel`) and three new server→client events (`stroke:preview:broadcast`, `stroke:cancel:broadcast`, `user:left`) added. All carry versioned, documented payloads. No polling. |
| **IV. Idempotency** | ✅ PASS | Preview events are transient and never stored or replayed; they do not participate in the deduplication layer. The committed `draw:stroke` event retains its `operationId`-based dedup. |
| **V. Convergence** | ✅ PASS | Previews are discarded at commit; final canvas state is determined solely by committed operations. All clients with the same committed op sequence produce identical output. |
| **VI. Loose Coupling** | ✅ PASS | New socket emissions routed exclusively through `socket.js`. Server preview handler references only the `sessions` map and `io`. `usePreviewLayer` communicates via socket service, not direct server imports. |
| **VII. Observability** | ✅ PASS | Server emits warning-level log (FR-017) on every `userId` mismatch drop, including `socketId` and received `userId`. |
| **VIII. Resilience** | ✅ PASS | On socket disconnect, server emits `user:left` to the room; clients remove all preview registry entries for that `userId`, satisfying SC-005 (< 5 s cleanup). Reconnection + re-hydration restores committed state as before. |

**Gate result**: All principles PASS. Proceed to Phase 0.

**Post-Phase 1 re-check**: All principles continue to hold after design. The two-canvas approach cleanly satisfies Principles II and IX. The `usePreviewLayer` hook boundary and the stateless server relay satisfy VI. No new violations introduced.

## Project Structure

### Documentation (this feature)

```text
specs/005-live-stroke-preview/
├── plan.md                          ← this file
├── research.md                      ← Phase 0 output
├── data-model.md                    ← Phase 1 output
├── quickstart.md                    ← Phase 1 output
├── contracts/
│   └── socket-events.md             ← Phase 1 output (new preview/cancel event schemas)
└── tasks.md                         ← Phase 2 output (/speckit.tasks — not created by /speckit.plan)
```

### Source Code (repository root)

```text
shared/
└── constants.js                     ← UPDATED: add EVENTS.STROKE_PREVIEW, EVENTS.STROKE_CANCEL,
                                                  SERVER_EVENTS.STROKE_PREVIEW_BROADCAST,
                                                  SERVER_EVENTS.STROKE_CANCEL_BROADCAST,
                                                  SERVER_EVENTS.USER_LEFT

client/src/
├── services/
│   └── socket.js                    ← UPDATED: add emitStrokePreview(), emitStrokeCancel()
├── tools/
│   ├── penTool.js                   ← UPDATED: operationId generated on pointer-down; throttled
│   │                                            preview emission; pointer-cancel/leave/enter
│   │                                            handlers; returns preview payload from pointer-move
│   └── eraserTool.js                ← UPDATED: same changes as penTool
├── hooks/
│   ├── useCanvas.js                 ← unchanged: canvas:cleared handling stays internal;
│   │                                            clearAllPreviews() is called directly from
│   │                                            Canvas.jsx on the canvas:cleared path (no
│   │                                            callback injection into useCanvas needed)
│   └── usePreviewLayer.js           ← NEW: manages previews Map<operationId, StrokePreview>;
│                                            subscribes to stroke:preview:broadcast,
│                                            stroke:cancel:broadcast, user:left; exposes
│                                            setPreview, removePreview, clearAllPreviews, previews
└── components/
    └── Canvas.jsx                   ← UPDATED: adds previewCanvasRef + overlay <canvas>;
                                                  uses usePreviewLayer; passes local preview to
                                                  preview layer on pointer-move; handles
                                                  onPointerCancel, onPointerLeave, onPointerEnter

client/src/hooks/
└── useCanvasRenderer.js             ← UPDATED: accept previewCanvasRef + previews; render preview
                                                  layer in a dedicated RAF-driven branch

server/src/
└── handlers/
    └── eventHandlers.js             ← UPDATED: add stroke:preview handler (validate userId, relay);
                                                  add stroke:cancel handler (validate userId, relay);
                                                  on disconnect: emit user:left to room

client/tests/unit/
├── penTool.test.js                  ← UPDATED: operationId at pointer-down; preview emission;
│                                               cancel/leave/enter behavior
├── eraserTool.test.js               ← UPDATED: same as penTool
├── usePreviewLayer.test.js          ← NEW: preview CRUD, socket subscription, clear-on-disconnect
└── useCanvasRenderer.test.js        ← UPDATED: preview layer rendering assertions

server/tests/integration/
└── drawHandlers.test.js             ← UPDATED: stroke:preview relay; userId mismatch drop + log;
                                                  stroke:cancel relay; user:left on disconnect
```

**Structure Decision**: Web application layout. `client/` is the React SPA; `server/` is the Node.js Socket.IO backend; `shared/` holds event name constants imported by both. The overlay canvas approach uses two stacked `<canvas>` elements inside a shared wrapper div — the preview canvas is absolutely positioned on top with `pointer-events: none`.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No violations — complexity tracking not required for this feature.
