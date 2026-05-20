# Implementation Plan: Collaborative Undo / Redo

**Branch**: `006-undo-redo` | **Date**: 2026-05-20 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `specs/006-undo-redo/spec.md`

## Summary

Add server-authoritative undo/redo to the collaborative canvas. Every user can undo their own pen/eraser strokes in reverse chronological order; any participant can undo the most recent canvas clear regardless of who triggered it; standard keyboard shortcuts (Ctrl+Z / Ctrl+Y, Cmd+Z / Cmd+Y) and toolbar buttons expose both controls. The server owns all history stacks (per-user undo/redo stacks capped at 20 entries, plus a room-level latest-clear reference); clients emit `undo:request` / `redo:request` events and apply only the canvas changes the server broadcasts back. Clients do not render speculatively — an unconfirmed request re-enables the control after a timeout without altering the canvas.

## Technical Context

**Language/Version**: JavaScript (ES2022 modules), React 18.3, JSX
**Primary Dependencies**: React 18, Vite 5, Vitest 1, @testing-library/react 16, socket.io-client 4, socket.io 4 (Node.js 20+)
**Storage**: In-memory server state per room — per-user undo/redo Maps + nullable `latestClearEntry`; history is not persisted across disconnects
**Testing**: Vitest + @testing-library/react + jsdom (client unit); Vitest + socket.io-client (server integration); Playwright (E2E)
**Target Platform**: Modern desktop browser + Node.js 20+
**Project Type**: React SPA (`client/`) + Node.js Socket.IO server (`server/`), multi-package monorepo
**Performance Goals**: Undo/redo change visible on all clients within 1 second under normal network conditions (SC-001)
**Constraints**: Server-authoritative — no optimistic UI; max 20 undo entries per user; clear events cannot be redone (FR-005); history cleared on disconnect; no new npm packages
**Scale/Scope**: ~10 new or modified source files; 1 new hook (`useUndoRedo.js`); 2 new toolbar buttons; 5 new socket events in `shared/constants.js`

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| **I. Test-First (TDD)** | ✅ PASS | All new/modified units get failing tests before implementation: `useUndoRedo`, `useCanvas` (removeOperation), `Toolbar` (disabled states), server undo/redo handlers, roomService undo/redo functions. E2E covers full multi-user undo/redo/clear flows. |
| **II. Modularity** | ✅ PASS | Undo/redo state management extracted to a new `useUndoRedo` hook; server-side history logic isolated in new `roomService` helper functions (`pushToUndoStack`, `clearRedoStack`, `resolveUndo`, `resolveRedo`, `getUndoRedoState`). Neither bleeds into unrelated modules. |
| **III. Event-Driven** | ✅ PASS | Five new named events: `undo:request`, `redo:request` (C→S); `undo:broadcast`, `redo:broadcast`, `undo:state` (S→C). All carry documented payloads. No polling introduced. |
| **IV. Idempotency** | ✅ PASS | Undo/redo outcomes are keyed on `operationId`; duplicate broadcasts are idempotent on the client because `removeOperation` is a no-op for an already-absent ID and `addOperation` already deduplicates. Server silently ignores extra undo/redo requests when the stack is already empty. |
| **V. Convergence** | ✅ PASS | Server is the single authority for history order and state mutations. All clients receive the same `undo:broadcast` / `redo:broadcast` sequence. `room.operations` on the server stays the source of truth; new joiners receive the post-undo operation list automatically. |
| **VI. Loose Coupling** | ✅ PASS | New socket emissions added to `socket.js` only; no component imports server modules directly. Server undo/redo logic lives in `roomService` (state) and `eventHandlers` (bindings), consistent with existing separation. |
| **VII. Observability** | ✅ PASS | Server logs every `undo:request` / `redo:request` with `{ event, roomId, userId, operationId?, durationMs }`. Ownership-check rejections (FR-013) logged at `warn` level. Room-state mutations after undo/redo logged at `info`. |
| **VIII. Resilience** | ✅ PASS | Client starts a 5-second timeout when emitting undo/redo; if no `undo:broadcast`/`redo:broadcast` arrives, control is re-enabled and canvas unchanged (FR-014). Server clears user history on disconnect, preventing stale history on reconnect. |

**Gate result**: All eight principles PASS. Proceed to Phase 0.

**Post-Phase 1 re-check**: All principles continue to hold after design. The server-authoritative model cleanly satisfies V and VIII. The hook boundary satisfies II. No new violations introduced.

## Project Structure

### Documentation (this feature)

```text
specs/006-undo-redo/
├── plan.md              ← this file
├── research.md          ← Phase 0 output
├── data-model.md        ← Phase 1 output
├── quickstart.md        ← Phase 1 output
├── contracts/
│   └── socket-events.md ← Phase 1 output
└── tasks.md             ← Phase 2 output (/speckit.tasks — NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
shared/
└── constants.js                     ← UPDATED: add EVENTS.UNDO_REQUEST, EVENTS.REDO_REQUEST;
                                                  SERVER_EVENTS.UNDO_BROADCAST,
                                                  SERVER_EVENTS.REDO_BROADCAST,
                                                  SERVER_EVENTS.UNDO_STATE;
                                                  UNDO_HISTORY_DEPTH = 20

server/src/
├── services/
│   └── roomService.js               ← UPDATED: add userUndoStacks / userRedoStacks /
│                                               latestClearEntry per room; new exports:
│                                               pushToUndoStack, clearRedoStack, resolveUndo,
│                                               resolveRedo, getUndoRedoState, clearUserHistory
└── handlers/
    └── eventHandlers.js             ← UPDATED: add undo:request handler; add redo:request
                                                  handler; emit undo:state to joining socket on
                                                  room:join and room:create; emit undo:state to
                                                  user after draw:stroke / canvas:clear; broadcast
                                                  updated undo:state to all room users after
                                                  clear undo; clear user history on disconnect

client/src/
├── services/
│   └── socket.js                    ← UPDATED: add emitUndoRequest(), emitRedoRequest()
├── hooks/
│   ├── useCanvas.js                 ← UPDATED: add removeOperation(operationId); expose via return
│   └── useUndoRedo.js               ← NEW: canUndo / canRedo state from undo:state;
│                                           requestUndo / requestRedo with 5-second timeout guard;
│                                           keyboard shortcut listener on document
│                                           (Ctrl+Z / Ctrl+Y / Cmd+Z / Cmd+Y);
│                                           handles undo:broadcast (removeOperation for stroke/clear)
│                                           and redo:broadcast (addOperation)
└── components/
    ├── Canvas.jsx                   ← UPDATED: integrate useUndoRedo; pass removeOperation
    │                                           from useCanvas
    └── Toolbar.jsx                  ← UPDATED: accept onUndo, onRedo, canUndo, canRedo props;
                                                  render Undo and Redo buttons with disabled state

client/tests/unit/
├── useUndoRedo.test.js              ← NEW: canUndo/canRedo state; requestUndo/Redo; timeout
│                                          guard; keyboard shortcuts; undo:broadcast /
│                                          redo:broadcast dispatch
├── useCanvas.test.js                ← UPDATED: removeOperation deduplication
└── Toolbar.test.jsx                 ← UPDATED: Undo/Redo button render;
                                                  disabled when !canUndo/!canRedo

server/tests/integration/
├── undoRedoHandlers.test.js         ← NEW: undo:request / redo:request flows (stroke + clear);
│                                          ownership validation rejection; undo:state after
│                                          join / draw / clear; clear undo by non-originating user
└── drawHandlers.test.js             ← UPDATED: undo:state emitted after draw:stroke / canvas:clear

e2e/
└── drawing.spec.js                  ← UPDATED: multi-user undo/redo/clear scenarios
```

**Structure Decision**: Web application layout (`client/` React SPA + `server/` Node.js). Follows the established pattern: hooks for client-side feature state, service functions in `roomService.js` for server-side state mutations, event bindings in `eventHandlers.js`.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No violations — complexity tracking not required for this feature.
