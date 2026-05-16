# Implementation Plan: Color Picker and Brush Size Controls

**Branch**: `004-color-brush-controls` | **Date**: 2026-05-16 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `specs/004-color-brush-controls/spec.md`

## Summary

Extend the `draw:stroke` pipeline to carry per-stroke `color` and `brushSize`. A new toolbar section in `Toolbar.jsx` lets users pick from a predefined 8-color palette (default `#111111`) and choose one of three numeric brush widths — small (2), medium (4), large (8). The chosen values are captured at pointer-up, embedded in the stroke payload transmitted via Socket.IO, transparently relayed and stored by the server, and used by the canvas renderer to draw each stroke with its own originating style. Strokes lacking these fields (pre-feature history) fall back to the default color and default brush width.

## Technical Context

**Language/Version**: JavaScript (ES2022 modules), React 18.3, JSX  
**Primary Dependencies**: React 18, Vite 5, Vitest 1, @testing-library/react 16, socket.io-client 4, socket.io 4  
**Storage**: In-memory server state (no new persistence; `color` + `brushSize` added to stored op objects)  
**Testing**: Vitest + @testing-library/react + jsdom (client unit); Jest + socket.io-client (server integration)  
**Target Platform**: Modern desktop browser (Chrome/Firefox/Edge); primary viewport ≥ 1024px  
**Project Type**: React SPA (`client/`) + Node.js Socket.IO server (`server/`), multi-package monorepo  
**Performance Goals**: No new runtime computation; two extra scalar fields per stroke payload are negligible  
**Constraints**: No new npm packages; no new CSS token variables (toolbar controls reuse the existing token system from spec 003); server acts as transparent relay — no server-side color validation  
**Scale/Scope**: 9 source files modified, 4 test files updated; no new source files required

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| **I. Test-First (TDD)** | ✅ PASS | All modified units get updated/new failing tests before implementation. Existing tests for `penTool`, `useCanvasRenderer`, `Toolbar`, and draw handler are updated first to assert the new params. |
| **II. Modularity** | ✅ PASS | Color/brushSize selection state lives in `RoomPage` (page orchestrator). Tools receive values as call-time arguments; renderer reads per-op fields. No new cross-module coupling introduced. |
| **III. Event-Driven** | ✅ PASS | Changes are strictly additive to the existing `draw:stroke` event payload. Event name and flow unchanged. Server still acts as broker; no polling. |
| **IV. Idempotency** | ✅ PASS | `operationId` deduplication logic in `roomService` is unaffected. New fields do not touch dedup keys. |
| **V. Convergence** | ✅ PASS | Per-stroke color and brushSize are immutable once pointer is lifted. All clients rendering the same op sequence produce identical visual output. No new conflict surface. |
| **VI. Loose Coupling** | ✅ PASS | Client→server path remains exclusively through `socket.js`. Color+brushSize are additive payload fields. No component imports server modules. |
| **VII. Observability** | ✅ PASS | Server log entry for `draw:stroke` augmented with `color` and `brushSize` fields for full traceability. |
| **VIII. Resilience** | ✅ PASS | Renderer falls back to `DEFAULT_STROKE_COLOR` and `DEFAULT_BRUSH_WIDTH` when fields are missing or invalid. No new failure mode introduced. |

**Gate result**: All applicable principles PASS. Proceed to Phase 0.

## Project Structure

### Documentation (this feature)

```text
specs/004-color-brush-controls/
├── plan.md                      ← this file
├── research.md                  ← Phase 0 output
├── data-model.md                ← Phase 1 output
├── quickstart.md                ← Phase 1 output
├── contracts/
│   ├── socket-events.md         ← Phase 1 output (draw:stroke payload extension)
│   └── component-props.md       ← Phase 1 output (Toolbar + Canvas prop additions)
└── tasks.md                     ← Phase 2 output (/speckit.tasks — not created by /speckit.plan)
```

### Source Code (repository root)

```text
shared/
└── constants.js                 ← UPDATED: add STROKE_PALETTE, BRUSH_PRESETS;
                                             rename STROKE_COLOR → DEFAULT_STROKE_COLOR (#111111);
                                             add DEFAULT_BRUSH_WIDTH = 4

client/src/
├── services/
│   └── socket.js                ← UPDATED: emitStroke(operationId, type, points, color, brushSize)
├── tools/
│   └── penTool.js               ← UPDATED: onPointerUp(event, canvas, color, brushSize);
│                                            includes color+brushSize in emitted payload + returned op
├── components/
│   ├── Toolbar.jsx              ← UPDATED: color swatch picker + brush size buttons; new props
│   ├── Canvas.jsx               ← UPDATED: accepts color+brushSize props; passes to penTool.onPointerUp
│   └── RoomPage.jsx             ← UPDATED: holds color+brushSize useState; passes to Toolbar+Canvas
└── hooks/
    └── useCanvasRenderer.js     ← UPDATED: renderDraw uses op.color ?? DEFAULT_STROKE_COLOR
                                             and op.brushSize ?? DEFAULT_BRUSH_WIDTH

server/src/
├── handlers/
│   └── eventHandlers.js        ← UPDATED: draw:stroke handler extracts + passes through color+brushSize
└── services/
    └── roomService.js           ← UPDATED: addOperation includes color+brushSize in fullOp

client/tests/unit/
├── penTool.test.js              ← UPDATED: assert color+brushSize in emitStroke call + returned op
├── useCanvasRenderer.test.js    ← UPDATED: per-op color test; missing-field fallback test
└── Toolbar.test.jsx             ← UPDATED: color picker + brush size control interaction tests

server/tests/integration/
└── drawHandlers.test.js         ← UPDATED: assert color+brushSize stored in room + rebroadcast
```

**Structure Decision**: Web application (Option 2 layout). `client/` is the SPA front-end; `server/` is the Node.js Socket.IO backend. Shared constants live in `shared/` and are resolved via workspace package aliasing.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |
