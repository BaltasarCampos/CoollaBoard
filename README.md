# CoollaBoard

A real-time collaborative whiteboard built with React, Node.js, and Socket.IO. Multiple users can draw simultaneously on a shared canvas with live stroke preview, undo/redo history, and a participants panel.

---

## Features

| Spec | Feature | Status |
|------|---------|--------|
| 001 | MVP: canvas, pen tool, room create/join, real-time sync | ✅ Done |
| 002 | Refactor: centralize constants in shared module | ✅ Done |
| 003 | UI design tokens: colors, typography, spacing system | ✅ Done |
| 004 | Color palette and brush size presets in toolbar | ✅ Done |
| 005 | Live stroke preview before commit (pen + eraser) | ✅ Done |
| 006 | Undo/redo with 20-deep history stack and confirm dialog | ✅ Done |
| 007 | Lift canvas state from component to dedicated hook | ✅ Done |
| 008 | Participants panel: real-time list of connected users | ✅ Done |

---

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Client framework | React | ^18.3.1 |
| Client build / dev server | Vite | ^5.3.1 |
| Real-time transport | Socket.IO (client + server) | ^4.7.5 |
| Server runtime | Node.js (ES modules) | — |
| Client tests | Vitest + @testing-library/react | ^1.6.0 / ^16.0.0 |
| Server tests | Jest | ^29.7.0 |
| E2E tests | Playwright | — |
| Linting | ESLint 9 | ^9.39.4 |
| Dev orchestration | concurrently + Nodemon | ^8.2.2 / ^3.1.4 |

---

## Project Structure

```
CoollaBoard/
├── client/              # React SPA (Vite)
│   └── src/
│       ├── components/  # Canvas, Toolbar, HomePage, RoomPage, ParticipantsPanel, …
│       ├── hooks/       # useCanvas, useRoom, useUndoRedo, useParticipants, …
│       ├── services/    # Socket.IO client wrapper
│       ├── tools/       # penTool, eraserTool, clearTool
│       ├── styles/      # global.css, design tokens
│       └── utils/       # coordinate helpers
├── server/              # Node.js + Socket.IO server
│   └── src/
│       ├── handlers/    # Socket event handlers
│       └── services/    # Room state management
├── shared/              # Constants shared between client and server
│   └── constants.js     # Event names, canvas config, tool presets, room config
├── e2e/                 # Playwright end-to-end tests
└── specs/               # Per-feature spec, plan, and task files (001–008)
```

---

## Getting Started

**Prerequisites**: Node.js 20+ and npm 10+.

```bash
# Install all workspace dependencies
npm install

# Start server and client concurrently (development)
npm run dev
```

Client runs at **http://localhost:5173** and the server on port **3000** by default.

---

## Dev Commands

### Monorepo root

```bash
npm run dev        # Start server + client concurrently
npm run test       # Run all tests (server + client)
npm run test:e2e   # Run Playwright E2E tests
```

### Client (`cd client`)

```bash
npm run dev          # Vite dev server
npm run build        # Production build
npm run preview      # Preview production build
npm run test         # Vitest (single run)
npm run test:watch   # Vitest in watch mode
npm run lint         # ESLint
```

### Server (`cd server`)

```bash
npm run dev          # Nodemon (watches for changes)
npm run start        # Production start
npm run test         # Jest (single run)
npm run test:watch   # Jest in watch mode
```

---

## Architecture

- **Event-driven**: All state changes flow through Socket.IO events — no polling. Client and server communicate exclusively via named events defined in `shared/constants.js`.
- **Full-list broadcasts**: Server sends the complete authoritative state (e.g., full participant list, full stroke history) rather than diffs, ensuring convergence after reconnects.
- **Modular hooks**: Each feature is encapsulated in its own hook (`useUndoRedo`, `useParticipants`, etc.) so components stay thin and features are independently testable.
- **Test-first**: Unit tests are written before implementation; integration tests cover server event handlers end-to-end.

---

## Canvas Config

| Setting | Value |
|---------|-------|
| Virtual canvas size | 1920 × 1080 px |
| Default stroke color | `#111111` |
| Default brush width | 4 px |
| Eraser radius | 20 px |
| Undo history depth | 20 operations |
| Room ID length | 6 chars (A–Z, 0–9) |
| Disconnect grace period | 45 seconds |

---

## Specs

Feature development follows an iterative spec-driven workflow. Each feature has a dedicated folder under `specs/` containing `spec.md`, `plan.md`, and `tasks.md`.