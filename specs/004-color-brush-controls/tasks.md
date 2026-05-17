# Tasks: Color Picker and Brush Size Controls

**Input**: Design documents from `specs/004-color-brush-controls/`
**Branch**: `004-color-brush-controls`
**Prerequisites**: [plan.md](plan.md) · [spec.md](spec.md) · [research.md](research.md) · [data-model.md](data-model.md) · [contracts/component-props.md](contracts/component-props.md) · [contracts/socket-events.md](contracts/socket-events.md) · [quickstart.md](quickstart.md)

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel with other [P] tasks in the same phase (different files, no shared dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Exact file paths included in every task description

---

## Phase 1: Foundation (Shared Constants)

**Purpose**: Extend `shared/constants.js` with all new constants required by this feature. This is the single blocking dependency — every subsequent phase reads from these values. No existing constants are removed yet to avoid unnecessary breakage during the Red phase.

**⚠️ CRITICAL**: All Phase 2–5 work depends on this phase being complete.

- [X] T001 Update `shared/constants.js` — add the following four new exports after the existing `STROKE_COLOR` line: `export const DEFAULT_STROKE_COLOR = '#111111'`; `export const DEFAULT_BRUSH_WIDTH = 4`; `export const STROKE_PALETTE = ['#111111','#ffffff','#ef4444','#f97316','#eab308','#22c55e','#3b82f6','#a855f7']`; `export const BRUSH_PRESETS = [{ label: 'S', value: 2 }, { label: 'M', value: 4 }, { label: 'L', value: 8 }]` — do NOT remove `STROKE_COLOR` yet; it is removed in T010 once its sole consumer (`useCanvasRenderer.js`) is updated

**Checkpoint**: Run `cd client && npm test -- --run` and `cd server && npm test` — all existing tests must still pass (additive change only; no breakage).

---

## Phase 2: TDD Pre-step — Update Tests (Red Phase)

**Purpose**: Update all four affected test files to assert the new per-stroke color and brushSize behavior before any implementation. Tests go from Green to **Red** here. The implementation phases that follow will make them Green again, restoring the Red → Green → Refactor TDD cycle.

**⚠️ Constitution Principle I compliance**: All test updates in this phase go Red against current code. Do not skip ahead to implementation before completing this phase.

- [X] T002 [P] [US1] [US2] Update `client/tests/unit/penTool.test.js` — in the existing "pointerdown starts a stroke" test, add assertions that `emitStroke` is called with 5 arguments where the 4th is a color string (e.g. `'#3b82f6'`) and the 5th is a numeric brushSize (e.g. `4`); update the existing "returns a local operation" test to also assert `op.color` and `op.brushSize` are present on the returned object; add a new test: "passes color and brushSize to emitStroke and returned op" — calls `onPointerDown`/`onPointerMove`/`onPointerUp` with explicit color `'#ef4444'` and brushSize `8` as the 3rd/4th args to `onPointerUp`, then asserts `emitStroke.mock.calls[0][3] === '#ef4444'` and `emitStroke.mock.calls[0][4] === 8`, and asserts the returned `op.color === '#ef4444'` and `op.brushSize === 8`

- [X] T003 [P] [US1] [US2] Update `client/tests/unit/useCanvasRenderer.test.js` — import `DEFAULT_STROKE_COLOR` and `DEFAULT_BRUSH_WIDTH` from `shared/constants.js` at the top of the test file; add test: "renderDraw uses op.color for ctx.strokeStyle" — renders a DRAW op with `color: '#ef4444'` and asserts `mockCtx.strokeStyle === '#ef4444'` after flushing the RAF; add test: "renderDraw falls back to DEFAULT_STROKE_COLOR when op.color is undefined" — renders a DRAW op with no `color` field and asserts `mockCtx.strokeStyle === DEFAULT_STROKE_COLOR`; add test: "renderDraw uses op.brushSize for ctx.lineWidth" — renders a DRAW op with `brushSize: 8` and asserts `mockCtx.lineWidth === 8`; add test: "renderDraw falls back to DEFAULT_BRUSH_WIDTH when op.brushSize is undefined" — renders a DRAW op with no `brushSize` field and asserts `mockCtx.lineWidth === DEFAULT_BRUSH_WIDTH`

- [X] T004 [P] [US1] [US2] [US3] Update `client/tests/unit/Toolbar.test.jsx` — in ALL existing `render(<Toolbar .../>)` calls, add the four new required props: `color="#111111" onColorChange={vi.fn()} brushSize={4} onBrushSizeChange={vi.fn()}` (this prevents existing tests from erroring once T013 adds required props); add test: "renders 8 color swatch buttons" — renders Toolbar with default props and asserts 8 elements with class `toolbar__color-swatch` are present; add test: "clicking a color swatch calls onColorChange with its hex value" — renders Toolbar, gets swatch buttons via `querySelectorAll('.toolbar__color-swatch')`, clicks the second swatch (`#ffffff`), and asserts `onColorChange` was called with `'#ffffff'`; add test: "active color swatch has toolbar__color-swatch--active class" — renders with `color="#ef4444"` and asserts the red swatch button has class `toolbar__color-swatch--active` while others do not; add test: "renders 3 brush size buttons" — asserts 3 elements with class `toolbar__size-btn` are present; add test: "clicking a brush size button calls onBrushSizeChange with its numeric value" — clicks the 'L' button (value 8) and asserts `onBrushSizeChange` was called with `8`; add test: "active brush size button has toolbar__size-btn--active class" — renders with `brushSize={8}` and asserts the 'L' button has class `toolbar__size-btn--active` while 'S' and 'M' do not

- [X] T005 [P] [US1] [US2] Update `server/tests/integration/drawHandlers.test.js` — add test: "stores color and brushSize in room operations when provided" — emits `draw:stroke` with `color: '#3b82f6'` and `brushSize: 8` included in the payload; re-joins the room and asserts `ack.operations[0].color === '#3b82f6'` and `ack.operations[0].brushSize === 8`; add test: "draw:broadcast includes color and brushSize when provided" — sets up sender+receiver, sends a stroke with `color: '#22c55e'` and `brushSize: 2`, and asserts the received broadcast has `broadcast.color === '#22c55e'` and `broadcast.brushSize === 2`; add test: "stores stroke without color or brushSize (undefined fields — backward compatibility)" — emits a stroke without those fields; re-joins and asserts `ack.operations[0].color === undefined` and `ack.operations[0].brushSize === undefined` (not erroring)

**Checkpoint**: Run `cd client && npm test -- --run` — expect T002, T003, T004 new assertions to fail (Red). Run `cd server && npm test` — expect T005 new assertions to fail (Red). This is the intended state before implementation.

---

## Phase 3: Server Implementation

**Purpose**: Update the server-side relay to extract, store, and rebroadcast `color` and `brushSize` as transparent pass-through fields. Makes T005 go Green.

- [X] T006 [P] [US1] [US2] Update `server/src/services/roomService.js` — in the `addOperation` function, add `color: op.color` and `brushSize: op.brushSize` to the `fullOp` object (insert after the `points` field; both will naturally be `undefined` for ERASE ops and pre-feature strokes, which is the correct backward-compatible behavior per data-model.md)

- [X] T007 [P] [US1] [US2] Update `server/src/handlers/eventHandlers.js` — in the `draw:stroke` handler: destructure `color` and `brushSize` from the incoming payload alongside the existing `{ operationId, type, points }`; pass `color` and `brushSize` into the `addOperation` call as part of the op object; add `color` and `brushSize` to the `logger.info` call after the `type` field for full observability per Architecture Principle VII

**Checkpoint**: Run `cd server && npm test` — all server tests pass including the new T005 assertions. Server implementation is complete and Green.

---

## Phase 4: Client Core Implementation

**Purpose**: Update the client-side pipeline so that `color` and `brushSize` flow from `RoomPage` state through `Canvas` → `penTool` → `emitStroke`, and the renderer reads per-stroke values from each op. Makes T002, T003, and T004 go Green.

- [X] T008 [US1] [US2] Update `client/src/services/socket.js` — update the `emitStroke` function signature to `emitStroke(operationId, type, points, color, brushSize)`; include `color` and `brushSize` in the emitted payload object (`socket.emit(EVENTS.DRAW_STROKE, { operationId, type, points, color, brushSize })`); `color` and `brushSize` are optional — undefined values are serialized as absent fields by Socket.IO, preserving backward compatibility for ERASE calls that omit them

- [X] T009 [US1] [US2] Update `client/src/tools/penTool.js` — update `onPointerUp(event, canvasEl, color, brushSize)` to accept two new call-time parameters; call `emitStroke(operationId, OP_TYPE.DRAW, snapshot, color, brushSize)` with the two new args; include `color` and `brushSize` in the returned local op object alongside `operationId`, `type`, and `points` — the returned shape is `{ operationId, type: OP_TYPE.DRAW, points: snapshot, color, brushSize }`

- [X] T010 [US1] [US2] Update `client/src/hooks/useCanvasRenderer.js` — replace `STROKE_COLOR` with `DEFAULT_STROKE_COLOR` and add `DEFAULT_BRUSH_WIDTH` in the import from `'shared/constants.js'` (also remove `BRUSH_WIDTH` from the import if it is not used elsewhere in this file after the change); update `renderDraw` to set `ctx.strokeStyle = op.color ?? DEFAULT_STROKE_COLOR` (instead of the global `STROKE_COLOR`); update `renderDraw` to set `ctx.lineWidth = op.brushSize ?? DEFAULT_BRUSH_WIDTH` (instead of the global `BRUSH_WIDTH`); after confirming `STROKE_COLOR` has no remaining usages in the codebase (`grep -r 'STROKE_COLOR' client/ server/ shared/`), remove the `STROKE_COLOR` export line from `shared/constants.js`

- [X] T011 [P] [US1] [US2] [US3] Update `client/src/components/RoomPage.jsx` — import `DEFAULT_STROKE_COLOR` and `DEFAULT_BRUSH_WIDTH` from `'shared/constants.js'`; add `const [color, setColor] = useState(DEFAULT_STROKE_COLOR)` and `const [brushSize, setBrushSize] = useState(DEFAULT_BRUSH_WIDTH)` below the existing `activeTool` state declaration; pass `color={color} onColorChange={setColor} brushSize={brushSize} onBrushSizeChange={setBrushSize}` to the `<Toolbar>` element; pass `color={color} brushSize={brushSize}` to the `<Canvas>` element

- [X] T012 [P] [US1] [US2] Update `client/src/components/Canvas.jsx` — add `color` and `brushSize` to the destructured props (alongside `activeTool, userId, roomId, initialOperations`); in `handlePointerUp`, pass them as 3rd and 4th args to `penTool.onPointerUp`: `localOp = penTool.onPointerUp(e.nativeEvent, canvas, color, brushSize)`; update the `useCallback` dependency array to include `color` and `brushSize`; `color` and `brushSize` are already included in `localOp` (set by the updated `penTool.onPointerUp`), so no changes are needed to the `addOperation` call

- [X] T013 [P] [US1] [US2] [US3] Update `client/src/components/Toolbar.jsx` — add `STROKE_PALETTE` and `BRUSH_PRESETS` to the import from `'shared/constants.js'`; add the four new props to the function signature: `color, onColorChange, brushSize, onBrushSizeChange`; inside the toolbar `<div>`, add a color swatch section rendering `STROKE_PALETTE.map(hex => <button key={hex} className={\`toolbar__color-swatch\${color === hex ? ' toolbar__color-swatch--active' : ''}\`} style={{ background: hex }} aria-label={hex} onClick={() => onColorChange(hex)} />)`; add a brush size section rendering `BRUSH_PRESETS.map(preset => <button key={preset.value} className={\`toolbar__size-btn\${brushSize === preset.value ? ' toolbar__size-btn--active' : ''}\`} onClick={() => onBrushSizeChange(preset.value)}>{preset.label}</button>)`; the inline `style={{ background: hex }}` on color swatches is intentional data-driven presentation (not aesthetic), equivalent to `Canvas.jsx`'s cursor inline style, and may be suppressed with `// eslint-disable-next-line react/forbid-component-props` if required by the ESLint config

**Checkpoint**: Run `cd client && npm test -- --run` — all tests pass including the new T002, T003, T004 assertions. Client implementation is fully Green.

---

## Phase 5: CSS for New Toolbar Controls

**Purpose**: Add visual styling for the color swatch buttons and brush size buttons introduced in T013. All values use the existing token system from spec 003 — no new token variables are introduced.

- [X] T014 [US1] [US2] Update `client/src/styles/components/toolbar.css` — append the following rule blocks after the existing `.toolbar__btn--active` rule: `.toolbar__color-swatch` (dimensions `width: 1.5rem; height: 1.5rem`, `border-radius: var(--radius-full)`, `border: 2px solid transparent`, `cursor: pointer`, `padding: 0`, `flex-shrink: 0`); `.toolbar__color-swatch--active` (`border-color: var(--color-primary)`, `outline: 2px solid var(--color-primary)`, `outline-offset: 1px`); `.toolbar__size-btn` (same visual base as `.toolbar__btn`: `border: 1px solid var(--color-border)`, `border-radius: var(--radius-md)`, `padding: var(--spacing-xs) var(--spacing-sm)`, `cursor: pointer`, `background: var(--color-surface-card)`, `color: var(--color-text-primary)`, `font-size: var(--font-size-sm)`, `font-weight: var(--font-weight-bold)`); `.toolbar__size-btn--active` (same as `.toolbar__btn--active`: `background: var(--color-primary); color: var(--color-text-on-primary)`)

---

## Phase 6: Verification

**Purpose**: Machine-verify all success criteria before marking the feature complete.

- [X] T015 [P] Run `cd client && npm test -- --run` — confirm **all** client tests pass with zero failures and zero skipped tests; validates FR-010 (existing tests remain green) and requirements SC-001, SC-002, SC-004, SC-005, SC-006

- [X] T016 [P] Run `cd server && npm test` — confirm **all** server integration tests pass with zero failures; validates FR-004 (color+brushSize transmitted and stored) and SC-003 (all participants see correct color/size)

**Final Checkpoint**: SC-001 (8 colors selectable — confirmed by Toolbar rendering 8 swatches), SC-002 (3 brush sizes selectable — confirmed by Toolbar rendering 3 size buttons), SC-003 (remote clients receive color+brushSize in broadcast — confirmed by drawHandlers integration test), SC-004 (color/size not lost on tool switch — confirmed by state living in RoomPage, not tool components), SC-005 (pre-feature strokes render with defaults — confirmed by useCanvasRenderer fallback tests), SC-006 (default state on room entry — confirmed by RoomPage initializing with DEFAULT_STROKE_COLOR and DEFAULT_BRUSH_WIDTH).

---

## Dependency Graph

```
T001 ──────────────────────────────────────────────────────────────────┐
                                                                        │
                        ┌── T002 (penTool test — Red)                  │
                        ├── T003 (renderer test — Red)   (all parallel)│
T001 ──────────────────►├── T004 (Toolbar test — Red)                  │
                        ├── T005 (server test — Red)                   │
                        ├── T006 (roomService impl)                    │
                        └── T007 (eventHandlers impl)                  │
                                                                        │
T006 + T007 ──────────► T005 Green (server tests pass)                 │
                                                                        │
T001 ──────────────────► T008 (socket.js)                              │
T008 ──────────────────► T009 (penTool.js) ──────────► T002 Green      │
T001 ──────────────────► T010 (useCanvasRenderer.js) ──► T003 Green    │
T001 ──────────────────► T011 (RoomPage.jsx)           (all parallel)  │
T009 + T011 ───────────► T012 (Canvas.jsx)                             │
T001 ──────────────────► T013 (Toolbar.jsx) ───────────► T004 Green    │
T013 ──────────────────► T014 (toolbar.css — parallel with T013)       │
                                                                        │
T008..T014 ────────────► T015 (client tests green)                     │
T006 + T007 ───────────► T016 (server tests green)                     │
```

**User Story Completion Order**: Foundation (T001) → Red tests (T002–T005) → Server relay (T006–T007, T005 Green) → Client pipeline (T008–T010, T002+T003 Green) → Component wiring (T011–T013, T004 Green) → CSS (T014) → Verification (T015–T016)

**Parallel Opportunities**:
- T002 ∥ T003 ∥ T004 ∥ T005 (all Phase 2 test updates, different files)
- T006 ∥ T007 (both Phase 3 server files)
- T010 ∥ T011 ∥ T013 (different client files; T010 and T013 have no inter-dependency)
- T014 can overlap with T013 (different files)
- T015 ∥ T016 (different test suites)

## Implementation Strategy

**MVP (after Phase 4)**: Color selection and brush size control are fully functional end-to-end — strokes carry color+brushSize through the full pipeline and render correctly for both the originating user and remote participants. Default state on room entry (US3) is a natural consequence of RoomPage state initialization. CSS polish (T014) is additive and does not block feature correctness.
