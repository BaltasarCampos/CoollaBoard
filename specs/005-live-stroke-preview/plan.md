# Implementation Plan: Live Stroke Preview

**Branch**: `005-live-stroke-preview` | **Date**: 2026-05-17 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `specs/005-live-stroke-preview/spec.md`

## Summary

Users currently only see a completed stroke appear on the canvas after they release the pointer. This feature makes every in-progress drawing stroke visible in real time — on the drawing user's own canvas (full opacity, immediate) and on all other users' canvases in the same room (reduced opacity, via new `draw:stroke-preview` socket events throttled at 30 ms). When a stroke is abandoned (pointer-cancel or pointer-leave), a `draw:stroke-cancel` event removes the preview from all canvases. The server is a stateless relay for preview events — it broadcasts but never persists them.

## Technical Context

**Language/Version**: JavaScript ES2022, Node.js 18+, React 18  
**Primary Dependencies**: React, Socket.IO 4.x (client + server), Vite, Canvas API  
**Storage**: N/A for previews — all preview state is transient, in-memory, per-client  
**Testing**: Vitest + React Testing Library (client unit/component), Vitest (server unit), Playwright (E2E)  
**Target Platform**: Chromium/Firefox/Safari web browser + Node.js server  
**Project Type**: Fullstack real-time collaborative web application  
**Performance Goals**: ≤30 ms preview event throttle (~33 updates/sec); <200 ms p95 preview-to-remote-render latency  
**Constraints**: Preview operations MUST NOT be persisted in room operation history; preview rendering MUST NOT corrupt committed canvas state  
**Scale/Scope**: Small collaborative rooms (2–10 users); ≥5 concurrent in-progress previews on a single canvas

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principle | Status | Notes |
|---|-----------|--------|-------|
| I | **Test-First** | ✅ PASS | TDD plan: unit tests for new tool preview methods and `useCanvas` preview state; integration tests for `draw:stroke-preview` / `draw:stroke-cancel` socket flows; E2E test for two-user live preview scenario |
| II | **Modularity** | ✅ PASS | Preview state isolated in `useCanvas`; preview rendering isolated in `useCanvasRenderer`; tool preview emission encapsulated in each tool module; no cross-tool coupling |
| III | **Event-Driven** | ✅ PASS | Two new named events added (`draw:stroke-preview`, `draw:stroke-cancel`); server remains a broker, never owns rendering logic; clients react to incoming events |
| IV | **Idempotency** | ✅ PASS | Each preview event carries the full accumulated points array — re-delivering the same event produces the same preview state. Preview events do not enter `seenOps` (they are not persisted). The final commit event carries a unique `operationId` and remains idempotent via existing `seenOps` deduplication |
| V | **Convergence** | ✅ PASS | Preview state is ephemeral and outside the convergence algorithm; only committed operations participate in `getVisibleOperations()` ordering |
| VI | **Loose Coupling** | ✅ PASS | New event names added to `shared/constants.js`; new emitters added to `client/src/services/socket.js`; server relay logic in `eventHandlers.js`; no direct cross-module imports |
| VII | **Observability** | ✅ PASS | Server MUST log `draw:stroke-preview` relay and `draw:stroke-cancel` relay events with `roomId`, `userId`, `operationId` |
| VIII | **Resilience** | ✅ PASS | On user disconnect, server emits `draw:preview-cancel` to room for all previews from that userId, clearing orphaned previews |

**Gate result: PASS** — no violations; proceeding to Phase 0.

## Project Structure

### Documentation (this feature)

```text
specs/005-live-stroke-preview/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── socket-events.md # Phase 1 output
└── tasks.md             # Phase 2 output (/speckit.tasks — NOT created here)
```

### Source Code (repository root)

```text
shared/
└── constants.js                    # ADD: EVENTS.DRAW_STROKE_PREVIEW, EVENTS.DRAW_STROKE_CANCEL,
                                    #      SERVER_EVENTS.PREVIEW_BROADCAST, SERVER_EVENTS.PREVIEW_CANCEL

client/src/
├── services/
│   └── socket.js                   # ADD: emitStrokePreview(), emitStrokeCancel()
├── tools/
│   ├── penTool.js                  # MODIFY: onPointerMove emits throttled preview; expose operationId
│   └── eraserTool.js              # MODIFY: onPointerMove emits throttled preview; expose operationId
├── hooks/
│   ├── useCanvas.js                # MODIFY: add previews Map state; handle preview-broadcast / preview-cancel
│   └── useCanvasRenderer.js        # MODIFY: render previews pass (remote at 0.6 alpha, local at 1.0 alpha)
└── components/
    └── Canvas.jsx                  # MODIFY: add onPointerLeave + onPointerCancel handlers; remove setPointerCapture

server/src/
└── handlers/
    └── eventHandlers.js            # MODIFY: relay draw:stroke-preview; relay draw:stroke-cancel;
                                    #         emit preview-cancel for all user previews on disconnect

client/tests/unit/
├── penTool.test.js                 # ADD: preview emission tests
├── eraserTool.test.js              # ADD: preview emission tests
├── useCanvas.test.js               # ADD: preview state management tests
└── useCanvasRenderer.test.js       # ADD: preview rendering tests (opacity, layer order)

server/tests/integration/
└── drawHandlers.test.js            # ADD: preview relay tests, cancel relay tests, disconnect cleanup tests

e2e/
└── drawing.spec.js                 # ADD: live stroke preview E2E scenarios (local + remote)
```

**Structure Decision**: Single web application with monorepo layout (existing `client/`, `server/`, `shared/`). Changes are additive — no new top-level directories needed. All new source files are test files only; all feature code extends existing modules.

## Complexity Tracking

> No constitution violations — this table is not required.
