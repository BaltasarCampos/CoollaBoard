# Implementation Plan: Codebase Refactor — Constants & Separation of Concerns

**Branch**: `002-refactor-constants-soc` | **Date**: 2026-05-14 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `specs/002-refactor-constants-soc/spec.md`

## Summary

Pure structural refactor with two goals: (1) replace every inline magic literal that corresponds to a value in `shared/constants.js` with its named constant, extending that file with three new constant groups (`TOOL_NAMES`, `CONNECTION_STATUS`, `ERROR_CODES`); and (2) extract business logic from four React components (`HomePage`, `RoomPage`, `Canvas`, `Toolbar`) into dedicated hooks/utilities so each component becomes a thin presentational layer. No new behaviour is introduced; all existing tests must continue to pass.

## Technical Context

**Language/Version**: JavaScript (ES2022) / React 18  
**Primary Dependencies**: React, Socket.IO client, Vite, Vitest, Playwright  
**Storage**: N/A (in-memory server state, no persistence layer)  
**Testing**: Vitest + React Testing Library (unit/integration), Playwright (E2E)  
**Target Platform**: Browser (modern) + Node.js 18+ server  
**Project Type**: Monorepo web application (`client/` + `server/` + `shared/`)  
**Performance Goals**: No regression — refactor must not degrade existing 60-fps canvas rendering  
**Constraints**: Zero observable behaviour change; all tests pass without modification  
**Scale/Scope**: ~15 source files affected across client, server, and shared layers

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I — Test-First | CONDITIONAL PASS | FR-007 forbids modifying existing tests. New `useHomePage` hook (FR-003) is new code and requires a test written before implementation per constitution. SC-005 mandates this explicitly. |
| II — Modularity | PASS | Tools remain in their own modules; no structural changes to tool layer. |
| III — Event-Driven | PASS | No socket events added, removed, or renamed. |
| IV — Idempotency | PASS | `operationId` generation moved to hook layer; semantics unchanged. |
| V — Convergence | PASS | No changes to `getVisibleOperations` convergence algorithm. |
| VI — Loose Coupling | **VIOLATION → FIXED** | `Toolbar` currently imports `emitClear` directly; `RoomPage` imports `getSocket`/`joinRoom` directly. This refactor is the explicit fix — after completion both components import only via hooks. |
| VII — Observability | PASS | No changes to logger or error surfacing. |
| VIII — Resilience | PASS | Reconnect/delta-hydration logic preserved, moved to hook layer. |

**Gate decision**: Proceed. The only active violation (Principle VI) is the explicit subject of this refactor.

**Post-Phase-1 re-check**: All principles remain PASS after design. No new violations introduced by extracted hooks (they use the socket service, not direct server imports).

## Project Structure

### Documentation (this feature)

```text
specs/002-refactor-constants-soc/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── hook-interfaces.md   # Phase 1 output (new hook APIs)
└── tasks.md             # Phase 2 output (/speckit.tasks — NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
shared/
└── constants.js          # +TOOL_NAMES, +CONNECTION_STATUS, +ERROR_CODES

client/src/
├── components/
│   ├── HomePage.jsx       # REFACTORED: presentational only, delegates to useHomePage
│   ├── RoomPage.jsx       # REFACTORED: remove direct socket imports, use useRoom
│   ├── Canvas.jsx         # REFACTORED: delegate rendering to useCanvasRenderer
│   ├── Toolbar.jsx        # REFACTORED: delegate clear flow to hook; use TOOL_NAMES
│   └── ConnectionStatus.jsx  # REFACTORED: use CONNECTION_STATUS constants
├── hooks/
│   ├── useHomePage.js     # NEW: room creation/joining + input validation
│   ├── useCanvasRenderer.js  # NEW: renderDraw, renderErase, resize logic
│   ├── useCanvas.js       # UNCHANGED (already well-structured)
│   └── useRoom.js         # MINOR: use ERROR_CODES constant
└── services/
    └── socket.js          # REFACTORED: use CONNECTION_STATUS constants

server/src/
└── handlers/
    └── eventHandlers.js   # REFACTORED: use ERROR_CODES constants

client/tests/unit/
├── useHomePage.test.js    # NEW (required by Constitution I + SC-005)
└── useCanvasRenderer.test.js  # NEW (required by SC-005)
```

**Structure Decision**: Monorepo web application layout. No new packages or directories created. Two new hook files added under `client/src/hooks/`. Two new test files added under `client/tests/unit/`.
