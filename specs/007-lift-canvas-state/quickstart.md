# Quickstart: Lift Canvas State to RoomPage

**Feature**: 007-lift-canvas-state  
**Date**: 2026-05-22

## What Changed

`RoomPage` is now the single owner of all collaborative room state. `Canvas` is a pure rendering/input surface. `Toolbar` is a sibling of `Canvas` inside `RoomPage`.

## Files Changed

| File | Change |
|---|---|
| `client/src/components/RoomPage.jsx` | Calls `useCanvas`, `useUndoRedo`; renders `Toolbar`; removes duplicate `useState` |
| `client/src/components/Canvas.jsx` | Removes `useCanvas`, `useUndoRedo`, `Toolbar`; accepts new props |
| `client/src/hooks/useCanvas.js` | Accepts optional `initialOperations` param |
| `client/src/hooks/useRoom.js` | Unchanged (or minor: addOperations wrapper) |
| `client/tests/unit/useCanvas.test.js` | Add test for `initialOperations` param |

## Running the App

No setup changes — same commands as before.

```bash
# From repo root
npm run dev          # starts server + client
```

## Running Tests

```bash
cd client && npm test          # Vitest unit tests
cd server && npm test          # Server integration tests
cd e2e && npx playwright test  # End-to-end tests
```

## Verifying the Refactor

1. Open a room and draw several strokes — they appear immediately.
2. Receive a remote stroke — it appears once (no duplicates from two state lists).
3. Click Undo — stroke removes; undo/redo buttons in the toolbar update.
4. Click Redo — stroke restores.
5. Click Clear — canvas blanks; undo/redo buttons reset.
6. Inspect React DevTools: `Toolbar` should appear as a direct child of `RoomPage`, not of `Canvas`. `Canvas` should have no `useCanvas` or `useUndoRedo` in its hooks list.

## Key Prop Changes on `Canvas`

**Added**:
- `addOperation`, `removeOperation`, `getVisibleOperations` — from `useCanvas` in `RoomPage`
- `canUndo`, `canRedo`, `requestUndo`, `requestRedo` — from `useUndoRedo` in `RoomPage`
- `onExternalClear` — called by `RoomPage` when `CANVAS_CLEARED` fires, triggers `clearAllPreviews`

**Removed**:
- `onToolChange`, `onClear`, `onColorChange`, `onBrushSizeChange` — `Toolbar` is now in `RoomPage`
- `initialOperations` — state is seeded in `useCanvas(initialOperations)` in `RoomPage`
