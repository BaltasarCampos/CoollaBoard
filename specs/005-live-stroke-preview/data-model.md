# Data Model: Live Stroke Preview

**Feature**: 005-live-stroke-preview  
**Date**: 2026-05-17

---

## Overview

This feature introduces two new transient data structures — `StrokePreview` and `PreviewRegistry` — alongside extensions to the existing `Session` server record. No new persistent storage is introduced; all preview state is in-memory and ephemeral.

---

## 1. StrokePreview

A transient, non-persisted snapshot of an in-progress drawing action. Sent over the wire in preview events and held in the client-side `PreviewRegistry`.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `operationId` | `string` (UUID v4) | Yes | Correlates with the eventual commit (`draw:stroke`). Same UUID used for the full lifetime of one stroke gesture. |
| `userId` | `string` (UUID v4) | Yes | Set by the server when relaying to remote clients. Not included in the client→server payload (server assigns from session). |
| `type` | `'DRAW' \| 'ERASE'` | Yes | Matches the `OP_TYPE` enum from `shared/constants.js`. |
| `points` | `Array<{x: number, y: number}>` | Yes | Full accumulated path in **virtual coordinate space** (0–1920 × 0–1080). Each emission replaces the prior points array entirely — no delta encoding. |
| `color` | `string` (hex) | Required when `type === 'DRAW'` | Hex color string, e.g. `'#ef4444'`. Must be from `STROKE_PALETTE` or the user's current selection. Omitted (or ignored) for `ERASE`. |
| `brushSize` | `number` | Required when `type === 'DRAW'` | Numeric brush width in virtual units. From `BRUSH_PRESETS` values (2, 4, or 8). Omitted for `ERASE`. |

**Validation rules**:
- `operationId` must be a valid UUID v4 string.
- `type` must be exactly `'DRAW'` or `'ERASE'`.
- `points` must be a non-empty array of objects each with numeric `x` and `y`.
- `color` (when present) must be a non-empty string.
- `brushSize` (when present) must be a positive number.

**Lifecycle**:
```
[pointerdown]        → operationId generated; tool state initialised
[pointermove × N]    → StrokePreview created/updated every ≥30 ms; emitted as draw:stroke-preview
[pointerup]          → StrokePreview cleared; full Operation committed via draw:stroke
[pointerleave / pointercancel] → StrokePreview cleared; draw:stroke-cancel emitted; nothing committed
```

---

## 2. PreviewRegistry

A per-client in-memory state structure held in the `useCanvas` React hook. Maps each active remote user's stroke to the latest received `StrokePreview`.

| Characteristic | Value |
|----------------|-------|
| Key | `operationId` (string) |
| Value | `StrokePreview` object |
| Mutability | Replaced on each new `draw:preview-broadcast` for the same key (**last-received-wins** — no sequence ordering is enforced; a stale out-of-order event may briefly overwrite a newer one, but the next arriving event will correct it within ≤ 30 ms); deleted on `draw:preview-cancel` or when a matching `draw:broadcast` (commit) arrives |
| Max entries | One per concurrently drawing remote user (in practice, room size − 1) |
| Persistence | None — lost on page reload; no synchronisation needed |

**State transitions**:

```
receive draw:preview-broadcast  → registry.set(operationId, preview)
receive draw:preview-cancel     → registry.delete(operationId)
receive draw:broadcast (commit) → registry.delete(operationId)  [remove preview, committed op takes over]
receive canvas:cleared          → registry.clear()
```

**Out-of-order event handling**: The `PreviewRegistry` uses last-received-wins semantics. No sequence number or monotonic counter is included in the `StrokePreview` schema. Under normal network conditions (< 50 ms RTT), out-of-order delivery is rare; when it occurs, the next on-time event self-corrects within the 30 ms throttle window. This is an explicit design choice — the added complexity of a monotonic `seq` field is not justified for transient preview data.

**Note**: The local drawing user's own in-progress stroke is **not** stored in `PreviewRegistry`. It is rendered directly from the tool module's internal `points` array via a dedicated render pass — this avoids React state churn on every pointer-move.

---

## 3. Session (server extension)

The existing per-socket `sessions` Map entry in `eventHandlers.js` gains one nullable field.

**Existing shape**:
```javascript
{ userId: string, roomId: string | null }
```

**Extended shape**:
```javascript
{ userId: string, roomId: string | null, activePreviewId: string | null }
```

| Field | Type | Description |
|-------|------|-------------|
| `activePreviewId` | `string \| null` | The `operationId` of the user's current in-flight preview, or `null` if not drawing. Used exclusively for disconnect cleanup: if set when the socket disconnects, the server emits `draw:preview-cancel` to the room. |

**Transitions**:
- Set to `operationId` on `draw:stroke-preview` received from this socket.
- Cleared to `null` on `draw:stroke-cancel` or `draw:stroke` (commit) received from this socket.
- If non-null on `disconnect`: server emits `draw:preview-cancel` for this `operationId`, then clears.

---

## 4. Relationship to Existing Operation Model

```
Operation (persisted, in room.operations[])
  ┌──────────────┐
  │ operationId  │◄──────────────── same UUID as StrokePreview.operationId
  │ sequenceNumber│                 (commit reuses the ID generated at pointer-down)
  │ type         │
  │ userId       │
  │ points       │◄──────────────── same coordinate space as StrokePreview.points
  │ color        │
  │ brushSize    │
  │ timestamp    │
  └──────────────┘
         ▲
         │  committed via draw:stroke → addOperation() → room.operations[]
         │
StrokePreview (transient, not persisted)
  ┌──────────────┐
  │ operationId  │
  │ userId       │
  │ type         │
  │ points       │  ← grows on each 30 ms throttle tick
  │ color        │
  │ brushSize    │
  └──────────────┘
```

The `operationId` is generated once at `pointerdown` and carried across all preview events **and** the final commit. This allows remote clients to delete a preview from `PreviewRegistry` as soon as the matching `draw:broadcast` (commit) arrives, preventing any visual duplication.
