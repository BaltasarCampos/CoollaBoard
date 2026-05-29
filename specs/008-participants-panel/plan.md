# Implementation Plan: Participants Panel

**Branch**: `008-participants-panel` | **Date**: 2026-05-26 | **Spec**: [spec.md](spec.md)  
**Input**: Feature specification from `specs/008-participants-panel/spec.md`

## Summary

Introduce a participants panel as a fixed right sidebar in `RoomPage`, listing every user currently connected to the room. The current user's name is rendered in bold with a "(You)" label. The panel reacts in real time to join and leave events via a new `participants:updated` Socket.IO broadcast.

Because the current codebase has no concept of display names (only server-generated UUIDs), this feature also introduces a name-entry step in the homepage flow, propagates the chosen name through the join/create socket payloads, and stores it on the server. A full participant list is returned with every `room:join`/`room:create` acknowledgement and re-broadcast as `participants:updated` on every join or disconnect.

## Technical Context

**Language/Version**: JavaScript (ES2022), React 18  
**Primary Dependencies**: React, Socket.IO client/server, Vitest, @testing-library/react  
**Storage**: N/A (in-memory room state on server; client state is derived/synchronized)  
**Testing**: Vitest + @testing-library/react (unit), Socket.IO integration tests (server), Playwright (E2E)  
**Target Platform**: Browser (modern; desktop-first)  
**Project Type**: Real-time collaborative web application  
**Performance Goals**: Participant list reflects join/leave within 1 s of event; no canvas rendering regression  
**Constraints**: No change to existing canvas operation contracts; display name limited to non-empty string, max 30 chars  
**Scale/Scope**: Adds 3 new files, modifies ~10 existing files; all existing tests must pass unchanged

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|---|---|---|
| I. Test-First | ✅ PASS | `useParticipants` unit test written before implementation; server handler integration test covers `participants:updated` broadcast |
| II. Modularity | ✅ PASS | `ParticipantsPanel` and `useParticipants` are self-contained modules; adding/removing the panel requires no changes to canvas modules |
| III. Event-Driven Architecture | ✅ PASS | Participant state is driven by `participants:updated` socket event; no polling; client reacts to incoming events |
| IV. Idempotency | ✅ PASS | `participants:updated` carries the full list — applying it twice results in the same state; no incremental-patch idempotency concern |
| V. Convergence & Conflict Resolution | ✅ PASS | Full-list broadcast eliminates ordering ambiguity; all clients converge to the same set after any event |
| VI. Loose Coupling | ✅ PASS | `ParticipantsPanel` receives props only; `useParticipants` communicates with server only via `socket.js`; new event names defined in `shared/constants.js` |
| VII. Observability | ✅ PASS | Server logs `participant:join` and `participant:leave` structured events with `roomId`, `userId`, `displayName` |
| VIII. Resilience | ✅ PASS | On reconnect, `useRoom` re-joins and the ack payload includes the fresh participant list; panel re-hydrates automatically |

**Re-check post-design**: All principles pass. No violations requiring justification.

## Project Structure

### Documentation (this feature)

```text
specs/008-participants-panel/
├── plan.md              ← this file
├── research.md          ← Phase 0 complete
├── data-model.md        ← Phase 1 complete
├── quickstart.md        ← Phase 1 complete
├── contracts/           ← Phase 1 complete (new socket events)
└── tasks.md             ← Phase 2 output (/speckit.tasks — not yet created)
```

### Source Code (files changed or created)

```text
shared/
└── constants.js                              ← add SERVER_EVENTS.PARTICIPANTS_UPDATED

server/
├── src/
│   ├── handlers/
│   │   └── eventHandlers.js                  ← read displayName from join/create payloads; emit participants:updated; update session
│   └── services/
│       └── roomService.js                    ← add userDisplayNames Map to room; update addUserToRoom/removeUserFromRoom; add getParticipants()

client/
├── src/
│   ├── components/
│   │   ├── HomePage.jsx                      ← add display-name input field
│   │   ├── RoomPage.jsx                      ← integrate ParticipantsPanel; pass participants + userId
│   │   └── ParticipantsPanel.jsx             ← NEW: renders participant list
│   ├── hooks/
│   │   ├── useHomePage.js                    ← add displayName state; pass to createRoom/joinRoom
│   │   ├── useRoom.js                        ← handle participants from ack; subscribe to participants:updated on reconnect
│   │   └── useParticipants.js                ← NEW: manage participants state, subscribe to participants:updated
│   ├── services/
│   │   └── socket.js                         ← update createRoom/joinRoom signatures to accept displayName
│   └── styles/
│       └── components/
│           └── participantspanel.css         ← NEW: panel layout and self-highlight styles
└── tests/
    └── unit/
        ├── ParticipantsPanel.test.jsx        ← NEW
        └── useParticipants.test.js           ← NEW
```

**No changes to**:
- `client/src/hooks/useCanvas.js`
- `client/src/hooks/useUndoRedo.js`
- `client/src/hooks/usePreviewLayer.js`
- `client/src/hooks/useCanvasRenderer.js`
- `client/src/components/Canvas.jsx`
- `client/src/components/Toolbar.jsx`
- `client/src/components/ConnectionStatus.jsx`
- `client/src/components/ConfirmDialog.jsx`
- All canvas-related tool files
- Existing server tests (must all continue to pass)

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |
