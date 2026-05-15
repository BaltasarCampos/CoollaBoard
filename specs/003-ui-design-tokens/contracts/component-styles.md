# Component Style Contracts

**Phase**: 1 — Design  
**Date**: 2026-05-15  
**Branch**: `feature/003-ui-design-tokens`

---

## Purpose

This document defines the **style interface contract** for each React component after the design token refactor. It specifies:

- Which CSS file owns the component's styles
- Which CSS classes the component applies to its elements
- Which modifier classes are applied conditionally
- Which tokens each class is permitted to consume

**Rule**: A component MUST NOT reference tokens outside its contract. A component MUST NOT use inline `style` props. Contracts are enforced by the ESLint rule `react/forbid-component-props` targeting `style`.

---

## Global Styles Contract

### File: `client/src/styles/tokens.css`

**Imported by**: `client/src/main.jsx` (once, at app entry)  
**Scope**: `:root` only — no element selectors  
**Contract**: Defines all primitive and semantic CSS Custom Properties. No rules targeting HTML elements or class names. No layout, no color application — definitions only.

### File: `client/src/styles/global.css`

**Imported by**: `client/src/main.jsx` (after `tokens.css`)  
**Scope**: `*, body, h1` — base reset and typography  
**Contract**:

| Selector | Tokens Consumed | Purpose |
|---|---|---|
| `*, *::before, *::after` | — | `box-sizing: border-box` reset |
| `body` | `--color-surface`, `--color-text-primary`, `--font-family-base`, `--font-size-base`, `--line-height-base` | Base page styles |
| `h1` | `--font-size-xl`, `--font-weight-bold`, `--color-text-primary` | Heading scale |

---

## Component Contracts

### `HomePage`

**File**: `client/src/styles/components/homepage.css`  
**Imported by**: `client/src/components/HomePage.jsx`

| Class | Element | Tokens | Notes |
|---|---|---|---|
| `.home-page` | Root `<div>` | `--spacing-lg`, `--color-surface` | Centered flex column, padding |
| `.home-page__title` | `<h1>` | *(inherits from global `h1`)* | No extra tokens needed |
| `.home-page__message--warning` | Warning `<p>` | `--color-message-warning` | Replaces `style={{ color: 'orange' }}` |
| `.home-page__message--error` | Error `<p>` | `--color-message-error` | Replaces `style={{ color: 'red' }}` |
| `.home-page__divider` | `<hr>` | `--color-border` | Replaces `style={{ width: '100%' }}` |
| `.home-page__join-row` | Join button row `<div>` | `--spacing-sm` | Replaces `style={{ display: 'flex', gap: '0.5rem' }}` |

**Button contract** (shared `.btn` class defined in `global.css`):

| Class | Tokens | Interactive States |
|---|---|---|
| `.btn` | `--color-primary`, `--color-text-on-primary`, `--radius-sm`, `--spacing-sm`, `--spacing-md`, `--font-weight-bold` | hover: `--color-primary-hover`; focus: `outline` using `--color-primary`; disabled: `opacity: 0.5` |
| `.btn:hover` | `--color-primary-hover` | Applied by `:hover` pseudo-class |
| `.btn:focus-visible` | `--color-primary` | Focus ring via `outline` |
| `.btn:disabled` | — | `opacity: 0.5; cursor: not-allowed` |

**Input contract** (shared `.input` class defined in `global.css`):

| Class | Tokens | Interactive States |
|---|---|---|
| `.input` | `--color-surface-input`, `--color-border`, `--radius-sm`, `--spacing-sm`, `--font-family-base`, `--font-size-base`, `--color-text-primary` | `text-transform: uppercase` (Room ID input specific — applied inline via `className` extension or a modifier class) |
| `.input:focus` | `--color-primary` | Focus ring; border color changes to `--color-primary` |
| `.input--room-id` | — | `text-transform: uppercase` modifier for the join room input |

---

### `RoomPage`

**File**: `client/src/styles/components/roompage.css`  
**Imported by**: `client/src/components/RoomPage.jsx`

| Class | Element | Tokens | Notes |
|---|---|---|---|
| `.room-page` | Root `<div>` | — | `display: flex; flex-direction: column; height: 100vh` |
| `.room-page__header` | Header bar `<div>` | `--color-surface-card`, `--color-border`, `--spacing-sm`, `--spacing-md`, `--shadow-sm` | Replaces inline `borderBottom: '1px solid #ddd'` and padding |
| `.room-page__room-id` | Room ID `<span>` | `--font-family-mono`, `--font-weight-bold`, `--color-text-secondary` | Replaces `style={{ fontFamily: 'monospace', fontWeight: 'bold' }}` |
| `.room-page__canvas-area` | Canvas wrapper `<div>` | — | `flex: 1; position: relative; overflow: hidden` |

**Leave button**: Uses the shared `.btn` class (see HomePage contract). No extra tokens.

---

### `Toolbar`

**File**: `client/src/styles/components/toolbar.css`  
**Imported by**: `client/src/components/Toolbar.jsx`

| Class | Element | Tokens | Notes |
|---|---|---|---|
| `.toolbar` | Root `<div>` | `--color-surface-card`, `--spacing-xs`, `--spacing-sm`, `--radius-md`, `--shadow-sm` | Replaces `style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem' }}` |
| `.toolbar__btn` | Tool button | `--color-border`, `--radius-sm`, `--spacing-xs`, `--spacing-sm`, `--font-weight-normal` | Base tool button style (inactive) |
| `.toolbar__btn--active` | Active tool button | `--color-primary`, `--color-text-on-primary` | Replaces `style={{ fontWeight: activeTool === TOOL_NAMES.PEN ? 'bold' : 'normal' }}` |
| `.toolbar__btn:hover` | Hovered tool button | `--color-primary-hover`, `--color-text-on-primary` | Intentional hover state |

---

### `ConnectionStatus`

**File**: `client/src/styles/components/connectionstatus.css`  
**Imported by**: `client/src/components/ConnectionStatus.jsx`

| Class | Element | Tokens | Notes |
|---|---|---|---|
| `.connection-status` | Root `<span>` | `--spacing-xs`, `--spacing-sm`, `--radius-full`, `--font-size-sm`, `--font-weight-bold`, `--color-text-on-primary` | Fixed position pill; layout replaces inline `style` object |
| `.connection-status--connected` | (modifier) | `--color-status-connected` | `background-color` only |
| `.connection-status--reconnecting` | (modifier) | `--color-status-reconnecting` | `background-color` only |
| `.connection-status--disconnected` | (modifier) | `--color-status-disconnected` | `background-color` only |

**Class application logic** (in component):
```jsx
const STATUS_CLASS = {
  [CONNECTION_STATUS.CONNECTED]:    'connection-status--connected',
  [CONNECTION_STATUS.RECONNECTING]: 'connection-status--reconnecting',
  [CONNECTION_STATUS.DISCONNECTED]: 'connection-status--disconnected',
};
// className={`connection-status ${STATUS_CLASS[status]}`}
```

**Test migration** (FR-011):
```js
// Before:
expect(el).toHaveStyle('background-color: #4caf50');
// After:
expect(el).toHaveClass('connection-status--connected');
```

---

### `ConfirmDialog`

**File**: `client/src/styles/components/confirmdialog.css`  
**Imported by**: `client/src/components/ConfirmDialog.jsx`

| Class | Element | Tokens | Notes |
|---|---|---|---|
| `.confirm-dialog` | Root `<div>` | `--color-warning-surface`, `--color-warning-border`, `--spacing-sm`, `--radius-sm` | Replaces `style={{ background: '#fff3cd', border: '1px solid #ffc107', ... }}` |
| `.confirm-dialog__message` | `<span>` | `--color-text-primary` | No extra tokens — inherits from body |

**Buttons inside ConfirmDialog**: Use the shared `.btn` class (see HomePage contract).

---

## Shared Classes (defined in `global.css`)

These classes are reusable across all components and are not component-specific.

| Class | Tokens | Usage |
|---|---|---|
| `.btn` | `--color-primary`, `--color-text-on-primary`, `--radius-sm`, `--spacing-sm`, `--spacing-md`, `--font-weight-bold`, `--font-size-base` | Primary action buttons |
| `.btn:hover` | `--color-primary-hover` | Hover state |
| `.btn:focus-visible` | `--color-primary` | Focus ring |
| `.btn:disabled` | — | `opacity: 0.5; cursor: not-allowed` |
| `.input` | `--color-surface-input`, `--color-border`, `--radius-sm`, `--spacing-sm`, `--font-family-base`, `--font-size-base`, `--color-text-primary` | Text inputs |
| `.input:focus` | `--color-primary` | Focus ring |
| `.input--room-id` | — | `text-transform: uppercase` modifier |

---

## Contract Violations

The following patterns are forbidden after this refactor and enforced by the ESLint rule:

| Forbidden | Reason | Correct Alternative |
|---|---|---|
| `style={{ color: 'red' }}` | Inline style — ESLint error | `className="home-page__message--error"` |
| `style={{ fontWeight: 'bold' }}` | Inline style — ESLint error | `className="toolbar__btn--active"` |
| `style={{ backgroundColor: '#4caf50' }}` | Hardcoded color in inline style — ESLint error | `className="connection-status--connected"` |
| `style={{ background: '#fff3cd', border: '1px solid #ffc107' }}` | Multiple inline styles — ESLint error | `className="confirm-dialog"` |
| Using a hex value in a CSS rule directly | Bypasses token system | Use `var(--color-*)` |
