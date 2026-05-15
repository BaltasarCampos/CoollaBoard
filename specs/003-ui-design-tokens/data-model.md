# Data Model: UI Design Tokens

**Phase**: 1 — Design  
**Date**: 2026-05-15  
**Branch**: `feature/003-ui-design-tokens`

---

## Overview

The design system for CoollaBoard is structured as a two-tier token taxonomy implemented with CSS Custom Properties. No database or persistent data model is involved — the "model" here is the naming and grouping schema for style values.

---

## Tier 1: Primitive Tokens

Raw, named values. Not referenced directly by component CSS. Provide a single point of palette definition.

### Color Primitives

| Token | Value | Description |
|---|---|---|
| `--indigo-600` | `#5c6bc0` | Base primary brand hue |
| `--indigo-700` | `#3949ab` | Darkened primary (hover) |
| `--gray-50` | `#f8f9fa` | Near-white surface |
| `--gray-100` | `#f1f3f4` | Slightly darker surface (inputs, cards) |
| `--gray-200` | `#e0e0e0` | Divider / border |
| `--gray-600` | `#616161` | Secondary text |
| `--gray-900` | `#212121` | Primary text (near-black) |
| `--white` | `#ffffff` | Pure white |
| `--green-600` | `#4caf50` | Connected status |
| `--orange-500` | `#ff9800` | Reconnecting status / warning messages |
| `--red-500` | `#f44336` | Disconnected status / error messages |
| `--yellow-100` | `#fff3cd` | Warning surface background |
| `--yellow-400` | `#ffc107` | Warning border |

### Non-color Primitives

Spacing, typography, and shape primitives are defined directly as semantic tokens (single tier sufficient at this scale — no raw spacing numeric scale needed).

---

## Tier 2: Semantic Tokens

Purpose-named CSS Custom Properties. These are what component CSS files reference via `var(--token-name)`.

### Color — Brand

| Token | Source Primitive | Usage |
|---|---|---|
| `--color-primary` | `var(--indigo-600)` | Primary buttons, active tool indicator, focus rings |
| `--color-primary-hover` | `var(--indigo-700)` | Button hover state |
| `--color-primary-ring` | `rgba(92, 107, 192, 0.15)` | Focus ring glow (semi-transparent indigo) — used for `box-shadow` on focused inputs; raw rgba defined here once so components reference `var(--color-primary-ring)` not a hardcoded value |

### Color — Surface & Text

| Token | Source Primitive | Usage |
|---|---|---|
| `--color-surface` | `var(--gray-50)` | Page background |
| `--color-surface-card` | `var(--white)` | Toolbar and header bar background |
| `--color-surface-input` | `var(--gray-100)` | Text input background |
| `--color-border` | `var(--gray-200)` | Dividers, input borders, card borders |
| `--color-text-primary` | `var(--gray-900)` | Body copy, labels, headings |
| `--color-text-secondary` | `var(--gray-600)` | Room ID, placeholders, secondary labels |
| `--color-text-on-primary` | `var(--white)` | Text rendered on primary-colored backgrounds |

### Color — Status (Connection Badge)

| Token | Source Primitive | Usage |
|---|---|---|
| `--color-status-connected` | `var(--green-600)` | Badge background when connected |
| `--color-status-reconnecting` | `var(--orange-500)` | Badge background when reconnecting |
| `--color-status-disconnected` | `var(--red-500)` | Badge background when disconnected |

### Color — Messages

| Token | Source Primitive | Usage |
|---|---|---|
| `--color-message-error` | `var(--red-500)` | Error text (e.g., failed room join) |
| `--color-message-warning` | `var(--orange-500)` | Info/warning text (e.g., kicked from room) |

### Color — Warning Surface (ConfirmDialog)

| Token | Source Primitive | Usage |
|---|---|---|
| `--color-warning-surface` | `var(--yellow-100)` | ConfirmDialog background |
| `--color-warning-border` | `var(--yellow-400)` | ConfirmDialog border |

### Spacing

| Token | Value | Approx (16px base) |
|---|---|---|
| `--spacing-xs` | `0.25rem` | 4px |
| `--spacing-sm` | `0.5rem` | 8px |
| `--spacing-md` | `1rem` | 16px |
| `--spacing-lg` | `2rem` | 32px |

### Typography

| Token | Value | Notes |
|---|---|---|
| `--font-family-base` | `'Inter', system-ui, -apple-system, sans-serif` | Body and UI text |
| `--font-family-mono` | `'JetBrains Mono', 'Fira Code', monospace` | Room ID display |
| `--font-size-sm` | `0.75rem` | Connection badge, secondary labels |
| `--font-size-base` | `1rem` | Default body size |
| `--font-size-lg` | `1.25rem` | Sub-headings |
| `--font-size-xl` | `2rem` | Page heading (`<h1>`) |
| `--font-weight-normal` | `400` | Default weight |
| `--font-weight-bold` | `600` | Headings, active states |
| `--line-height-base` | `1.5` | Comfortable reading |

### Shape

| Token | Value | Usage |
|---|---|---|
| `--radius-sm` | `4px` | Buttons, inputs, small chips |
| `--radius-md` | `6px` | Cards, toolbar bar |
| `--radius-full` | `9999px` | Connection status pill badge |
| `--shadow-sm` | `0 1px 3px rgba(0,0,0,0.08)` | Toolbar bar elevation |
| `--shadow-md` | `0 2px 8px rgba(0,0,0,0.12)` | Focused input, active button |

---

## Token → Component Mapping

Documents which tokens each component consumes. Enforces the Component Style Contract.

| Component | Token Group | Specific Tokens Used |
|---|---|---|
| `global.css` (body) | Surface, Typography | `--color-surface`, `--color-text-primary`, `--font-family-base`, `--font-size-base`, `--line-height-base` |
| `global.css` (`.input:focus`) | Brand | `--color-primary` (border), `--color-primary-ring` (box-shadow glow) |
| `HomePage` | Surface, Typography, Spacing, Brand | `--color-surface`, `--color-primary`, `--color-primary-hover`, `--color-border`, `--spacing-md`, `--spacing-sm`, `--spacing-lg`, `--radius-sm`, `--font-size-xl`, `--font-weight-bold`, `--color-text-on-primary`, `--color-message-error`, `--color-message-warning`, `--color-surface-input` |
| `RoomPage` | Surface, Typography, Spacing, Shape | `--color-surface-card`, `--color-border`, `--spacing-sm`, `--spacing-md`, `--font-family-mono`, `--font-weight-bold`, `--color-text-secondary`, `--shadow-sm` |
| `Toolbar` | Brand, Surface, Spacing, Shape | `--color-primary`, `--color-primary-hover`, `--color-text-on-primary`, `--color-surface-card`, `--color-border`, `--spacing-xs`, `--spacing-sm`, `--radius-sm` |
| `ConnectionStatus` | Status, Typography, Shape | `--color-status-connected`, `--color-status-reconnecting`, `--color-status-disconnected`, `--color-text-on-primary`, `--font-size-sm`, `--font-weight-bold`, `--radius-full`, `--spacing-xs`, `--spacing-sm` |
| `ConfirmDialog` | Warning, Spacing, Shape | `--color-warning-surface`, `--color-warning-border`, `--spacing-sm`, `--radius-sm` |

---

## State Transitions: Toolbar Active Tool

The Toolbar component has a visual state machine: one of `{PEN, ERASER, CLEAR}` is active at a time. The active tool button receives the class modifier `toolbar__btn--active`. No new state is introduced — this replaces the existing inline `fontWeight: bold` toggle.

```
Tool state: PEN | ERASER | CLEAR
  ↓ (class applied via activeTool prop comparison)
button.className = 'toolbar__btn' + (active ? ' toolbar__btn--active' : '')
```

---

## State Transitions: ConnectionStatus

The ConnectionStatus component maps connection state to a CSS class modifier. Replaces the existing inline `STYLES` object.

```
status: CONNECTED → .connection-status--connected
status: RECONNECTING → .connection-status--reconnecting
status: DISCONNECTED → .connection-status--disconnected
```
