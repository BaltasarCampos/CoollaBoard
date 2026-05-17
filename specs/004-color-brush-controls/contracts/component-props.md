# Component Prop Contracts: Color Picker and Brush Size Controls

**Phase**: 1 — Design  
**Date**: 2026-05-16  
**Branch**: `004-color-brush-controls`

This document defines the updated public prop interfaces for `Toolbar.jsx` and `Canvas.jsx`. The `RoomPage.jsx` prop interface is unchanged (it receives `roomId`, `userId`, `onLeaveRoom`, `initialOperations` from above and manages color/brushSize internally).

---

## `Toolbar`

**File**: `client/src/components/Toolbar.jsx`

### Updated Prop Interface

```js
Toolbar({
  activeTool:        string,            // unchanged — 'pen' | 'eraser'
  onToolChange:      (tool: string) => void,  // unchanged
  onClear:           () => void,        // unchanged — default: clearCanvas from useRoom.js
  color:             string,            // NEW — current hex color (from STROKE_PALETTE)
  onColorChange:     (color: string) => void, // NEW — called when user picks a color swatch
  brushSize:         number,            // NEW — current numeric width (from BRUSH_PRESETS)
  onBrushSizeChange: (size: number) => void,  // NEW — called when user picks a brush size
})
```

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `activeTool` | `string` | ✅ | — | Identifies the active tool (`TOOL_NAMES.PEN` or `TOOL_NAMES.ERASER`) |
| `onToolChange` | `function(tool)` | ✅ | — | Callback when a tool button is clicked |
| `onClear` | `function()` | ❌ | `clearCanvas` | Callback when clear is confirmed |
| `color` | `string` | ✅ | — | Currently selected hex color; drives active state on color swatches |
| `onColorChange` | `function(color)` | ✅ | — | Called with the hex string of the clicked color swatch |
| `brushSize` | `number` | ✅ | — | Currently selected brush width; drives active state on size buttons |
| `onBrushSizeChange` | `function(size)` | ✅ | — | Called with the numeric value of the clicked size button |

### Rendered Elements

| Element | Class | Condition |
|---------|-------|-----------|
| Color swatch `<button>` (×8) | `toolbar__color-swatch` | Always |
| Active color swatch | `toolbar__color-swatch--active` | `color === swatchColor` |
| Brush size `<button>` (×3) | `toolbar__size-btn` | Always |
| Active size button | `toolbar__size-btn--active` | `brushSize === preset.value` |

### Guarantees

1. `onColorChange` is called with a string value that is a member of `STROKE_PALETTE`.
2. `onBrushSizeChange` is called with a numeric value that is a member of `BRUSH_PRESETS.map(p => p.value)`.
3. The currently selected color swatch and size button each display the `--active` modifier class.
4. Color and brush size controls are rendered only when `activeTool === TOOL_NAMES.PEN` (the eraser tool is unaffected by either control, so controls may be visually present but their values are ignored by the eraser).
5. No state is held inside `Toolbar` for color or brushSize — it is a controlled component for both.

---

## `Canvas`

**File**: `client/src/components/Canvas.jsx`

### Updated Prop Interface

```js
Canvas({
  activeTool:        string,    // unchanged
  userId:            string,    // unchanged
  roomId:            string,    // unchanged
  initialOperations: Operation[], // unchanged — default: []
  color:             string,    // NEW — current drawing color; embedded in emitted stroke
  brushSize:         number,    // NEW — current brush width; embedded in emitted stroke
})
```

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `activeTool` | `string` | ✅ | — | Active tool name; controls which tool handles pointer events |
| `userId` | `string` | ✅ | — | Session user ID; added to local op for consistency with server ops |
| `roomId` | `string` | ✅ | — | Room ID; used to trigger re-hydration on room change |
| `initialOperations` | `Operation[]` | ❌ | `[]` | Ops to hydrate on mount |
| `color` | `string` | ✅ | — | Hex color passed to `penTool.onPointerUp` at stroke commit time |
| `brushSize` | `number` | ✅ | — | Numeric width passed to `penTool.onPointerUp` at stroke commit time |

### Guarantees

1. `color` and `brushSize` are read at the time of `pointerup` (stroke commit), not at the time of `pointerdown`. A color change mid-stroke takes effect on the next stroke, not the current one.
2. `color` and `brushSize` are included in both the emitted socket payload and the local optimistic operation added to `operationsState`.
3. The eraser tool ignores `color` and `brushSize` — `eraserTool.onPointerUp` is called without those arguments; they are not in the eraser payload.

---

## `penTool` — Updated `onPointerUp` Signature

**File**: `client/src/tools/penTool.js`

```js
// Before
onPointerUp(event: PointerEvent, canvasEl: HTMLCanvasElement): LocalOp | null

// After
onPointerUp(event: PointerEvent, canvasEl: HTMLCanvasElement, color: string, brushSize: number): LocalOp | null
```

The returned `LocalOp` now includes `color` and `brushSize`:

```js
{
  operationId: string,  // UUID v4
  type: 'DRAW',
  points: Point[],
  color: string,       // NEW — passed through from call arg
  brushSize: number,   // NEW — passed through from call arg
}
```
