# Quickstart: UI Design Tokens & Modern Restyle

**Phase**: 1 — Design  
**Date**: 2026-05-15  
**Branch**: `feature/003-ui-design-tokens`

---

## What This Feature Does

Replaces all scattered inline `style` props in CoollaBoard's React components with external CSS classes backed by a centralized CSS Custom Property token system. The result is a clean, light, modern visual aesthetic with a consistent indigo brand accent, and a lint rule that prevents inline styles from returning.

---

## Implementation Steps (ordered)

### Step 1 — Install ESLint Dependencies

```bash
cd client
npm install --save-dev eslint @eslint/js globals eslint-plugin-react
```

### Step 2 — Create ESLint Flat Config

Create `client/eslint.config.js`:

```javascript
import js from '@eslint/js';
import globals from 'globals';
import reactPlugin from 'eslint-plugin-react';

export default [
  js.configs.recommended,
  {
    files: ['src/**/*.{js,jsx}'],
    languageOptions: {
      globals: { ...globals.browser },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { react: reactPlugin },
    rules: {
      'react/forbid-component-props': ['error', { forbid: ['style'] }],
    },
    settings: { react: { version: 'detect' } },
  },
];
```

Add lint script to `client/package.json`:
```json
"lint": "eslint src"
```

**Verify**:
```bash
cd client && npx eslint src
# Expect: many errors (all existing inline style props flagged)
# This is the "Red" phase — expected before the refactor.
```

### Step 3 — Create Token File

Create `client/src/styles/tokens.css` with the full `:root` block from [data-model.md](data-model.md).

### Step 4 — Create Global Base Styles

Create `client/src/styles/global.css`:

```css
/* Reset */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

body {
  background-color: var(--color-surface);
  color: var(--color-text-primary);
  font-family: var(--font-family-base);
  font-size: var(--font-size-base);
  line-height: var(--line-height-base);
}

h1 {
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
}

/* Shared: Primary Button */
.btn {
  padding: var(--spacing-xs) var(--spacing-md);
  background-color: var(--color-primary);
  color: var(--color-text-on-primary);
  border: none;
  border-radius: var(--radius-sm);
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-bold);
  cursor: pointer;
  transition: background-color 150ms ease;
}
.btn:hover { background-color: var(--color-primary-hover); }
.btn:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }
.btn:disabled { opacity: 0.5; cursor: not-allowed; }

/* Shared: Text Input */
.input {
  padding: var(--spacing-xs) var(--spacing-sm);
  background-color: var(--color-surface-input);
  color: var(--color-text-primary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-family: var(--font-family-base);
  font-size: var(--font-size-base);
  transition: border-color 150ms ease;
}
.input:focus { outline: none; border-color: var(--color-primary); box-shadow: var(--shadow-md); }
.input--room-id { text-transform: uppercase; }
```

### Step 5 — Import Styles at Entry Point

Update `client/src/main.jsx`:

```jsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import './styles/tokens.css';
import './styles/global.css';
import App from './App.jsx';

const root = createRoot(document.getElementById('root'));
root.render(<App />);
```

### Step 6 — Create Component CSS Files

Create one CSS file per component under `client/src/styles/components/`. Refer to [contracts/component-styles.md](contracts/component-styles.md) for the exact class names and tokens each file should use.

| File | Component it styles |
|---|---|
| `homepage.css` | `HomePage.jsx` |
| `roompage.css` | `RoomPage.jsx` |
| `toolbar.css` | `Toolbar.jsx` |
| `connectionstatus.css` | `ConnectionStatus.jsx` |
| `confirmdialog.css` | `ConfirmDialog.jsx` |

Each file is imported at the top of its corresponding component file.

### Step 7 — Refactor Component JSX

For each component, in this order:
1. Import the new CSS file.
2. Remove all `style={{...}}` props (ESLint will flag every remaining one).
3. Replace with `className="..."` using classes from the contract.
4. For conditional styles, compute the class name string (see `ConnectionStatus` and `Toolbar` patterns in the contract doc).

**Example — ConnectionStatus refactor**:

```jsx
// Before
const style = { position: 'fixed', bottom: '1rem', right: '1rem', ...STYLES[status] };
return <span style={style}>{status}</span>;

// After
import './../../styles/components/connectionstatus.css';
const STATUS_CLASS = {
  [CONNECTION_STATUS.CONNECTED]:    'connection-status--connected',
  [CONNECTION_STATUS.RECONNECTING]: 'connection-status--reconnecting',
  [CONNECTION_STATUS.DISCONNECTED]: 'connection-status--disconnected',
};
return (
  <span
    data-testid="connection-status"
    className={`connection-status ${STATUS_CLASS[status]}`}
  >
    {status}
  </span>
);
```

### Step 8 — Update Tests (FR-011)

Open `client/tests/unit/ConnectionStatus.test.jsx` and `Toolbar.test.jsx`. Replace any `toHaveStyle(...)` call that asserts an inline style property with `toHaveClass(...)`.

```js
// Before
expect(badge).toHaveStyle('background-color: #4caf50');
// After
expect(badge).toHaveClass('connection-status--connected');

// Before
expect(penBtn).toHaveStyle('font-weight: bold');
// After
expect(penBtn).toHaveClass('toolbar__btn--active');
```

Run tests to confirm green:
```bash
cd client && npm test
```

### Step 9 — Verify Lint Passes

```bash
cd client && npx eslint src
# Expect: 0 errors
```

---

## Verification Checklist

| Check | Command / Method |
|---|---|
| SC-001: Zero inline `style` props | `npx eslint src` → 0 errors |
| SC-007: Full test suite green | `npm test` → all pass |
| SC-005: Visual appearance | Open browser, load Home Page and Room Page — confirm light, modern look |
| SC-006: Interactive states | Tab through both pages; hover buttons; confirm visible states |
| SC-002: Token traceability | Inspect any colour in DevTools → trace to `tokens.css` |

---

## File Layout After Completion

```
client/
├── eslint.config.js              ← NEW
├── package.json                  ← UPDATED (devDependencies + lint script)
└── src/
    ├── main.jsx                  ← UPDATED (imports tokens.css, global.css)
    ├── styles/
    │   ├── tokens.css            ← NEW
    │   ├── global.css            ← NEW
    │   └── components/
    │       ├── homepage.css      ← NEW
    │       ├── roompage.css      ← NEW
    │       ├── toolbar.css       ← NEW
    │       ├── connectionstatus.css  ← NEW
    │       └── confirmdialog.css    ← NEW
    └── components/
        ├── HomePage.jsx          ← UPDATED
        ├── RoomPage.jsx          ← UPDATED
        ├── Toolbar.jsx           ← UPDATED
        ├── ConnectionStatus.jsx  ← UPDATED
        └── ConfirmDialog.jsx     ← UPDATED
```

---

## Key Decisions

| Decision | Choice | See |
|---|---|---|
| Token delivery mechanism | CSS Custom Properties (`:root` + `var()`) | [research.md § Topic 1](research.md) |
| ESLint config format | Flat config (`eslint.config.js`) | [research.md § Topic 2](research.md) |
| Test assertion strategy | `toHaveClass` not `toHaveStyle` | [research.md § Topic 3](research.md) |
| Token naming | Two-tier (primitive → semantic) | [research.md § Topic 4](research.md) |
| CSS class naming | BEM-adjacent component-prefixed | [research.md § Topic 5](research.md) |
| Primary brand colour | `--color-primary: #5c6bc0` (indigo) | [data-model.md](data-model.md) |
| Responsive scope | Desktop-first ≥ 1024px; no overlap below | [spec.md § Clarifications](spec.md) |
