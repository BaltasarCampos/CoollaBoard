# Implementation Plan: Lift Canvas State to RoomPage

**Branch**: `007-lift-canvas-state` | **Date**: 2026-05-22 | **Spec**: [spec.md](spec.md)  
**Input**: Feature specification from `specs/007-lift-canvas-state/spec.md`

## Summary

Eliminate the duplicate operations state that exists in both `RoomPage` (`useState`) and `Canvas` (`useCanvas`). Move `useCanvas` and `useUndoRedo` to `RoomPage`, making `Canvas` a stateless rendering/input component. `Toolbar` becomes a direct child of `RoomPage` as a result. `RoomPage` becomes the single authoritative owner of all collaborative room state.

Key design decisions from research:
- `useCanvas` retains its internal socket subscriptions (`DRAW_BROADCAST`, `CANVAS_CLEARED`) — no change to the convergence algorithm
- `useCanvas` gains an optional `initialOperations` parameter (seeded into `useState`)
- `usePreviewLayer` stays in `Canvas`; a new `onExternalClear` prop handles the cleared-event preview flush
- `Canvas` calls `addOperation` prop directly on pointer-up (no extra callback indirection)
- `.canvas-wrapper` stays in `Canvas`; `Toolbar` and `Canvas` are siblings in `.room-page__canvas-area`

## Technical Context

**Language/Version**: JavaScript (ES2022), React 18  
**Primary Dependencies**: React, Socket.IO client, Vitest, @testing-library/react  
**Storage**: N/A (in-memory room state on server; client state is derived/synchronized)  
**Testing**: Vitest + @testing-library/react (unit), Socket.IO integration tests (server), Playwright (E2E)  
**Target Platform**: Browser (modern; desktop-first)  
**Project Type**: Real-time collaborative web application  
**Performance Goals**: No regression — canvas renders at 60 fps; undo/redo latency unchanged  
**Constraints**: No changes to server code, shared constants, or socket event schemas  
**Scale/Scope**: Client-only refactor; 5 files changed, 14 existing unit tests must pass

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|---|---|---|
| I. Test-First | ✅ PASS | `useCanvas` gets a new test for `initialOperations`; all existing tests must pass unchanged |
| II. Modularity | ✅ PASS | `Canvas` becomes more isolated — no room-state hooks; each module has a cleaner single responsibility |
| III. Event-Driven Architecture | ✅ PASS | Socket event subscriptions remain in `useCanvas` and `useRoom`; no new polling introduced |
| IV. Idempotency | ✅ PASS | `addOperation` deduplication logic is unchanged; `operationId` uniqueness enforced as before |
| V. Convergence & Conflict Resolution | ✅ PASS | `getVisibleOperations` convergence algorithm unchanged; CLEAR op still stored in operations list |
| VI. Loose Coupling | ✅ PASS | `Canvas` removes its direct socket dependency (`useCanvas`, `useUndoRedo`); coupling reduced |
| VII. Observability | ✅ PASS | No logging changes required; refactor is client-side structural only |
| VIII. Resilience | ✅ PASS | Reconnect delta-sync path (`useRoom` → `addOperations`) preserved |

**Re-check post-design**: All principles continue to pass. No violations requiring justification.

## Project Structure

### Documentation (this feature)

```text
specs/007-lift-canvas-state/
├── plan.md              ← this file
├── research.md          ← Phase 0 complete
├── data-model.md        ← Phase 1 complete
├── quickstart.md        ← Phase 1 complete
├── contracts/           ← N/A (no new external interface contracts; see below)
└── tasks.md             ← Phase 2 output (/speckit.tasks — not yet created)
```

**Contracts**: No new contracts directory needed. This refactor does not add or change any externally visible interface (no new socket events, no new REST endpoints, no new public API). The only interface change is the `Canvas` component prop surface, documented in `data-model.md`.

### Source Code (files changed)

```text
client/
├── src/
│   ├── components/
│   │   ├── RoomPage.jsx          ← adds useCanvas, useUndoRedo, Toolbar; removes duplicate useState
│   │   └── Canvas.jsx            ← removes useCanvas, useUndoRedo, Toolbar; adds new props
│   └── hooks/
│       └── useCanvas.js          ← adds optional initialOperations parameter
└── tests/
    └── unit/
        └── useCanvas.test.js     ← adds test for initialOperations parameter
```

**No changes to**:
- `server/` (any file)
- `shared/constants.js`
- `client/src/hooks/useRoom.js`
- `client/src/hooks/useUndoRedo.js`
- `client/src/hooks/usePreviewLayer.js`
- `client/src/hooks/useCanvasRenderer.js`
- `client/src/components/Toolbar.jsx`
- `client/src/components/ConnectionStatus.jsx`
- All other test files
