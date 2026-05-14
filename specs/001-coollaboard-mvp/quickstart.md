# Quickstart: CoollaBoard MVP

**Phase**: 1 — Design & Contracts  
**Date**: 2026-05-14  
**Plan**: [plan.md](plan.md)

---

## Prerequisites

- Node.js 20 LTS (`node --version` → `v20.x.x`)
- npm 10+ (`npm --version`)
- Git (for branch management)

---

## Repository Layout

```
CoollaBoard/          ← monorepo root (npm workspaces)
├── client/           ← React 18 + Vite 5 frontend
├── server/           ← Node.js 20 + Socket.IO 4 backend
├── shared/           ← Shared constants (no build step)
├── e2e/              ← Playwright end-to-end tests
└── package.json      ← workspace root
```

---

## First-Time Setup

```bash
# 1. Clone and branch
git clone <repo-url> CoollaBoard
cd CoollaBoard
git checkout 001-coollaboard-mvp

# 2. Install all workspace dependencies (client + server + e2e)
npm install

# 3. Install Playwright browsers (first time only)
npx playwright install --with-deps chromium
```

---

## Running the App (Development)

Open **two terminals**:

**Terminal 1 — backend**:
```bash
cd server
npm run dev
# Server starts on http://localhost:3001
# Socket.IO path: ws://localhost:3001/socket.io
```

**Terminal 2 — frontend**:
```bash
cd client
npm run dev
# Vite dev server starts on http://localhost:5173
# Proxies /socket.io requests to localhost:3001
```

Open **http://localhost:5173** in your browser.

---

## Running Tests

### Frontend unit / integration tests (Vitest)
```bash
cd client
npm test              # run once
npm run test:watch    # watch mode
npm run test:coverage # with coverage report
```

### Backend unit / integration tests (Jest)
```bash
cd server
npm test              # run once
npm run test:watch    # watch mode
```

### End-to-end tests (Playwright)
```bash
# Requires both dev servers running (see above), or start them automatically:
cd e2e
npm test                        # headless
npm run test:ui                 # Playwright UI mode
npm run test:headed             # visible browser
```

### Run all tests from root
```bash
npm test    # runs client, server, and e2e tests in sequence
```

---

## Key Configuration

| Setting | File | Value |
|---------|------|-------|
| Backend port | `server/src/index.js` | `3001` (env: `PORT`) |
| Frontend dev port | `client/vite.config.js` | `5173` |
| Socket.IO proxy | `client/vite.config.js` | `/socket.io → http://localhost:3001` |
| Room grace period | `shared/constants.js` | 45 000 ms |
| Virtual canvas size | `shared/constants.js` | 1920 × 1080 |
| Brush width | `shared/constants.js` | 4 virtual units |
| Eraser radius | `shared/constants.js` | 20 virtual units |

---

## Trying the App Manually

1. Open **http://localhost:5173** in **Tab A** → click **Create Room** → note the 6-character room ID.
2. Open **http://localhost:5173** in **Tab B** → enter the room ID → click **Join**.
3. Draw in Tab A → verify the stroke appears in Tab B within 1 second.
4. Switch to the erase tool in Tab B → erase a stroke → verify the erasure appears in Tab A.
5. Click **Clear Canvas** in either tab → confirm → verify both tabs show a blank canvas.

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | HTTP / Socket.IO server port |
| `NODE_ENV` | `development` | `development` or `production` |
| `LOG_LEVEL` | `info` | Logger level: `debug` · `info` · `warn` · `error` |

Create `server/.env` for local overrides (not committed to git):
```
PORT=3001
LOG_LEVEL=debug
```

---

## Useful Scripts Reference

| Location | Script | Purpose |
|----------|--------|---------|
| root | `npm test` | Run all tests |
| root | `npm run lint` | ESLint across all workspaces |
| `client/` | `npm run dev` | Vite dev server |
| `client/` | `npm run build` | Production build (`dist/`) |
| `client/` | `npm test` | Vitest unit/integration |
| `server/` | `npm run dev` | nodemon dev server |
| `server/` | `npm start` | Production start |
| `server/` | `npm test` | Jest unit/integration |
| `e2e/` | `npm test` | Playwright E2E |

---

## Troubleshooting

**"Room not found" immediately after creating a room**  
→ Check the backend is running on port 3001 and the Vite proxy is configured.

**Canvas appears blank after join**  
→ Open browser devtools → Network → WS → confirm the `room:join` acknowledgement contains `operations`.

**Strokes visible locally but not synced**  
→ Check browser console for socket errors. Confirm both clients are in the same room ID.

**Playwright tests time out**  
→ Ensure both dev servers (`client/` and `server/`) are running before executing E2E tests, or configure Playwright's `webServer` option in `playwright.config.js` to auto-start them.
