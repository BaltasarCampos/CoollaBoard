# Research: Color Picker and Brush Size Controls

**Phase**: 0 — Research  
**Date**: 2026-05-16  
**Plan**: [plan.md](plan.md)

---

## Research Question 1: How to Thread Drawing Context Through the Tool → Socket → Renderer Pipeline

**Decision**: Pass `color` and `brushSize` as explicit call-time arguments to `penTool.onPointerUp`. Capture from `RoomPage` state at the moment of pointer-up and embed in the emitted payload and returned local op.

**Rationale**: The pen tool is a singleton created once outside the component (`const penTool = createPenTool()` in `Canvas.jsx`). It cannot hold per-render color state because it is not a React component. The simplest pattern that doesn't require redesigning the tool module is to pass drawing context as arguments at call time, similar to how `canvasEl` is already passed. This is consistent with how the eraser tool passes context without holding internal configuration state.

**Alternatives considered**:
- *Tool factory takes color/brushSize config re-created per render*: Would require re-creating the tool on every color/size change, or holding a ref to the config object. More complex with no benefit.
- *Global drawing context object mutated via refs*: Would introduce shared mutable state, violating the Loose Coupling principle.
- *New `useDrawingState` hook (separate module)*: Evaluated but unnecessary. `color` and `brushSize` are simple UI state with a single owner (`RoomPage`), the same way `activeTool` is already managed as `useState` in `RoomPage`. A dedicated hook would add indirection without modularity benefit for two scalar values.

---

## Research Question 2: State Ownership for Color and Brush Size

**Decision**: Add `color` and `brushSize` as `useState` in `RoomPage.jsx`. Pass as props to `Toolbar.jsx` (controls) and `Canvas.jsx` (stroke emission).

**Rationale**: `RoomPage` already owns `activeTool` as local state in the same pattern. Color and brush size follow the same single-owner/prop-drill model. The component tree is: `RoomPage → Toolbar` (for display and user control) and `RoomPage → Canvas` (for embedding in strokes). Two levels of prop passing with two scalar values does not warrant lifting to a shared context or custom hook. This follows the existing project convention exactly.

**Alternatives considered**:
- *React Context for drawing state*: Overkill for two scalar values with one owner. Would add context overhead and a new pattern inconsistent with the rest of the codebase.
- *State in `Canvas.jsx`*: Canvas would need to expose callbacks up to `RoomPage` for `Toolbar` to observe — backwards data flow, violating React unidirectional data flow.
- *State in `Toolbar.jsx`*: `Canvas.jsx` needs the values too; `Toolbar` is a sibling, not an ancestor of `Canvas`. Would require lifting state anyway.

---

## Research Question 3: Server Relay Strategy for New Payload Fields

**Decision**: The server acts as a transparent relay. `eventHandlers.js` extracts `color` and `brushSize` from the incoming payload and passes them to `addOperation`. `roomService.addOperation` includes them (verbatim, no validation) in the `fullOp` object stored to `room.operations` and rebroadcast to other clients.

**Rationale**: Constitution Principle VI states the server routes events without owning rendering logic. Color and brush size are client-rendering metadata, not room-management data. Server-side validation of color values against the palette would create a coupling between server logic and client UI choices. Per FR-001a (colors restricted to palette) and the clarified fallback strategy (FR-009: invalid values fall back to defaults in the renderer), enforcement belongs at the renderer, not the relay.

**Alternatives considered**:
- *Server validates and rejects unknown color values*: Breaks backward compatibility, creates server-client coupling, and contradicts the relay principle.
- *Server strips color/brushSize before storing*: Defeats the purpose; historical strokes would lose their style metadata.

---

## Research Question 4: Backward Compatibility Strategy

**Decision**: `color` and `brushSize` are optional fields in the `DrawingOperation` schema. The renderer uses null-coalescing (`op.color ?? DEFAULT_STROKE_COLOR`, `op.brushSize ?? DEFAULT_BRUSH_WIDTH`) to fall back to defaults when these fields are absent or `undefined`.

**Rationale**: The server returns stored operations verbatim to new joiners. Pre-feature strokes stored without `color` or `brushSize` will have `undefined` for both fields when loaded. The null-coalescing fallback is the minimal, safe handling specified in FR-009 and confirmed in clarification Q3.

**Impact on Tests**: The `useCanvasRenderer` test suite needs an explicit test for the fallback case (op without color/brushSize still renders with default values) and a test for the happy path (op with color/brushSize uses those values).

---

## Research Question 5: Test Coverage Strategy

**Decision**: Update 4 existing test files (red-phase before implementation). No new test files needed. Additions per file:

| File | Tests Added / Updated |
|------|-----------------------|
| `client/tests/unit/penTool.test.js` | Assert `emitStroke` 5th/6th args carry color+brushSize; assert returned op includes those fields |
| `client/tests/unit/useCanvasRenderer.test.js` | Add: per-op color sets `ctx.strokeStyle`; missing color falls back to `DEFAULT_STROKE_COLOR`; per-op brushSize sets `ctx.lineWidth`; missing brushSize falls back to `DEFAULT_BRUSH_WIDTH` |
| `client/tests/unit/Toolbar.test.jsx` | Add: color swatches render; clicking a swatch calls `onColorChange`; brush size buttons render; clicking a size button calls `onBrushSizeChange`; active color swatch has active class; active brush size button has active class |
| `server/tests/integration/drawHandlers.test.js` | Add: `draw:stroke` with color+brushSize stores them in room operations; rebroadcast includes color+brushSize; stroke without color+brushSize stores correctly (undefined fields) |

**Rationale**: All changed units are individually testable in isolation. No new integration test file is needed because the server integration tests already cover the `draw:stroke` → room storage → re-join flow; we only add color/brushSize assertions to existing scenarios.

---

## Research Question 6: Constant Naming and Palette Selection

**Decision**:
- Rename `STROKE_COLOR = '#000000'` → `DEFAULT_STROKE_COLOR = '#111111'` (value change + rename; update import in `useCanvasRenderer.js`)
- `BRUSH_WIDTH = 4` already equals the medium preset; add `DEFAULT_BRUSH_WIDTH = 4` explicitly for clarity of renderer intent
- Add `STROKE_PALETTE` array (8 colors)
- Add `BRUSH_PRESETS` array (3 entries)

```js
export const DEFAULT_STROKE_COLOR = '#111111';
export const DEFAULT_BRUSH_WIDTH  = 4;

export const STROKE_PALETTE = [
  '#111111', // near-black (default)
  '#ffffff', // white
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#3b82f6', // blue
  '#a855f7', // purple
];

export const BRUSH_PRESETS = [
  { label: 'S', value: 2 },
  { label: 'M', value: 4 },
  { label: 'L', value: 8 },
];
```

**Rationale**: `STROKE_COLOR` was the only consumer of the old constant (in `useCanvasRenderer.js`). Renaming removes ambiguity between "the current user selection" and "the fallback default". The palette of 8 hues satisfies SC-001. Presets of 2/4/8 (confirmed in clarification Q2) give clear visual separation and satisfy SC-002. All values are pulled from `constants.js` per the Loose Coupling principle.

**Alternatives considered**:
- *Keep `STROKE_COLOR` as an alias*: No consumer other than `useCanvasRenderer.js` uses it, so an alias is purely noise.
- *Store palette as object map `{name: hex}`*: Unnecessary; only the hex value is needed for rendering and transmission. Labels are concerns for the UI layer (Toolbar).
