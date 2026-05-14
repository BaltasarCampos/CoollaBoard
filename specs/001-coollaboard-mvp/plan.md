# Implementation Plan: CoollaBoard MVP

**Branch**: `001-coollaboard-mvp` | **Date**: 2026-05-14 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `specs/001-coollaboard-mvp/spec.md`

## Summary

Build a real-time collaborative freehand drawing canvas (CoollaBoard MVP). Multiple anonymous users share a drawing room — identified by a 6-character alphanumeric room ID — where they can draw, erase, and clear a shared canvas in real time over Socket.IO. Room state lives in server memory only; no persistence or authentication is required. The implementation follows a React (Canvas API + Socket.IO client) / Node.js (Socket.IO server) monorepo split into `client/`, `server/`, and `shared/`.

## Technical Context

**Language/Version**: Node.js 20 LTS (backend) · JavaScript ES2022 · React 18 (frontend)
**Primary Dependencies**: Socket.IO 4.x (server + client), React 18, HTML5 Canvas API, Vite 5 (frontend build)
**Storage**: Server in-memory only — plain JS `Map` objects; no database or file persistence
**Testing**: Vitest + React Testing Library (frontend unit/integration) · Jest (backend unit/integration) · Playwright (E2E multi-tab)
**Target Platform**: Desktop browsers (Chrome 120+, Firefox 125+, Edge 120+) · Node.js 20 LTS server (Linux)
**Project Type**: Web application — real-time collaborative canvas
**Performance Goals**: Stroke latency < 1 s p95 (SC-003); room join < 3 s (SC-002); 500-op state hydration < 3 s (SC-007); ≥ 5 concurrent users without stroke loss (SC-005)
**Constraints**: In-memory only; no auth; desktop browsers only; data loss on server restart acceptable; virtual coordinate space fixed at 1920×1080; eraser radius fixed at 20 units; stroke color black, brush width 4 units
**Scale/Scope**: MVP — ~5+ concurrent users per room; unbounded drawing-operation log per room (no cap)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principle | Status | Notes |
|---|-----------|--------|-------|
| I | **Test-First** | ✅ PASS | Test strategy defined (Vitest / Jest / Playwright). Tests must be written before each implementation unit. |
| II | **Modularity** | ✅ PASS | `pen`, `eraser`, and `clear` will each be independent modules under `client/src/tools/`. The canvas renderer and socket service are separate modules. |
| III | **Event-Driven** | ✅ PASS | All user actions emit named Socket.IO events. Server routes events; clients react to incoming events. No polling. |
| IV | **Idempotency** | ✅ PASS | Every `DrawingOperation` carries a `operationId` (UUID v4). Server deduplicates before broadcasting. |
| V | **Convergence** | ✅ PASS | Server assigns a monotonically increasing `sequenceNumber` per room. Clients replay operations in sequence order to reconstruct canvas state. |
| VI | **Loose Coupling** | ✅ PASS | All client–server communication goes through `client/src/services/socket.js`. Shared event names and payload schemas live in `shared/constants.js`. |
| VII | **Observability** | ✅ PASS | `server/src/utils/logger.js` emits structured JSON logs with `timestamp`, `level`, `roomId`, `userId`, `event`, and `durationMs`. |
| VIII | **Resilience** | ✅ PASS | Socket.IO client configured with exponential-backoff reconnection. On reconnect, client re-hydrates state via `room:join`. Connection-status indicator (Connected / Reconnecting / Disconnected) is always visible. |

**All gates pass. Proceeding to Phase 0 research.**

## Project Structure

### Documentation (this feature)

```text
specs/001-coollaboard-mvp/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── socket-events.md
└── tasks.md             # Phase 2 output (speckit.tasks — not created by speckit.plan)
```

### Source Code (repository root)

```text
client/                           # React frontend (Vite)
├── src/
│   ├── components/
│   │   ├── Canvas.jsx            # Main canvas element + rendering loop
│   │   ├── Toolbar.jsx           # Tool selector (pen / eraser / clear)
│   │   ├── RoomPage.jsx          # Canvas page with room ID display
│   │   ├── HomePage.jsx          # Create / join room landing page
│   │   └── ConnectionStatus.jsx  # Fixed-corner connection indicator
│   ├── hooks/
│   │   ├── useCanvas.js          # Canvas drawing state and rendering
│   │   └── useRoom.js            # Room join/leave and socket lifecycle
│   ├── services/
│   │   └── socket.js             # Single Socket.IO client adapter
│   ├── tools/
│   │   ├── penTool.js            # Freehand draw logic
│   │   ├── eraserTool.js         # Area-based erase logic
│   │   └── clearTool.js          # Clear canvas action
│   └── utils/
│       └── coordinates.js        # Virtual ↔ screen coordinate helpers
├── tests/
│   ├── unit/
│   └── integration/
└── vite.config.js

server/
├── src/
│   ├── handlers/
│   │   └── eventHandlers.js      # Socket.IO event bindings
│   ├── services/
│   │   └── roomService.js        # Room CRUD + operation log + TTL eviction
│   └── utils/
│       └── logger.js             # Structured JSON logger
├── tests/
│   ├── unit/
│   └── integration/
└── index.js                      # Entry point — http server + Socket.IO init

shared/
└── constants.js                  # Event names, defaults (brush width, eraser radius, etc.)

e2e/                              # Playwright end-to-end tests
├── room.spec.js
├── drawing.spec.js
└── playwright.config.js

package.json                      # Monorepo root (workspaces)
```

**Structure Decision**: Monorepo with npm workspaces. `client/` (Vite + React), `server/` (Node.js), `shared/` (constants only — no build step). `e2e/` at root for Playwright multi-tab tests. This is the layout mandated by the constitution.
