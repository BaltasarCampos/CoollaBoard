# Research: UI Design Tokens & Modern Restyle

**Phase**: 0 — Research  
**Date**: 2026-05-15  
**Branch**: `feature/003-ui-design-tokens`

---

## Topic 1: CSS Custom Properties as Design Tokens

### Decision
Use CSS Custom Properties (`--var-name`) defined in a `:root` block in a single `tokens.css` file, imported once at the application entry point (`main.jsx`).

### Rationale
- **Native browser support**: CSS Custom Properties are supported in all modern browsers (Chrome 49+, Firefox 31+, Safari 9.1+, Edge 16+) with no build tooling required.
- **Vite-native**: Vite serves CSS files as-is — no special configuration required to support `--var-name` syntax.
- **Single source of truth propagation**: Changing `--color-primary` in `tokens.css` is reflected in every rule that uses `var(--color-primary)` without any component code change (satisfies SC-003).
- **Future dark mode**: CSS Custom Properties can be overridden inside a `[data-theme="dark"]` selector or a `prefers-color-scheme` media query with zero structural change to component files (satisfies the out-of-scope dark mode assumption).

### Alternatives Considered
| Alternative | Rejected Because |
|---|---|
| SCSS variables | Requires adding a preprocessor to Vite config; static at build time (not runtime-overridable); breaks the future dark mode path |
| JS token constants (`tokens.js`) | Runtime values; cannot be targeted by CSS pseudo-class selectors (`:hover`, `:focus`); requires CSS-in-JS to consume; incompatible with external CSS files |
| Tailwind CSS | Requires significant config and migration; all existing class conventions would change; over-engineered for a 5-component app |

---

## Topic 2: ESLint Configuration for a Vite + React ESM Project

### Decision
Add `eslint`, `eslint-plugin-react`, `@eslint/js`, and `globals` as `devDependencies` to `client/package.json`. Create `client/eslint.config.js` using the **flat config** format (required for `"type": "module"` projects with ESM).

### Rationale
- No existing ESLint config is present in the project.
- Vite 5 + React 18 + `"type": "module"` requires flat config (`eslint.config.js`), not the legacy `.eslintrc.*` format.
- `react/forbid-component-props` from `eslint-plugin-react` is the precise rule that enforces FR-001: it reports an error whenever the `style` prop is used on a React component.
- Adding ESLint as a `devDependency` (not a peer dep) keeps the install footprint minimal.

### Exact Config

```javascript
// client/eslint.config.js
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

### Alternatives Considered
| Alternative | Rejected Because |
|---|---|
| Legacy `.eslintrc.json` | Incompatible with `"type": "module"` — Node will error on CommonJS `require()` in an ESM package |
| `eslint-config-airbnb` | Brings hundreds of opinionated rules; over-engineered for a single targeted lint constraint |
| Manual code review | Subjective, unverifiable on PRs; fails SC-001 (machine-verifiable zero violations) |

---

## Topic 3: Testing Library — Asserting Class Names vs. Inline Style Values

### Decision
Replace all `toHaveStyle(...)` assertions that target inline property values with `toHaveClass(...)` assertions that check for the presence of the correct CSS class. Do **not** attempt to assert computed CSS Custom Property values.

### Rationale
- JSDOM (Vitest's default test environment) does **not** parse or apply CSS stylesheets. It does not compute `var(--color-primary)` into a final colour value. Therefore `toHaveStyle('color: var(--color-primary)')` or `toHaveStyle('background-color: #5c6bc0')` will both return `false` in JSDOM even if the CSS file is correct.
- `toHaveClass('connection-status--connected')` reliably verifies that the component applies the correct semantic class, which is the behaviour under test. Visual correctness (the class renders the right colour) is the responsibility of E2E / visual regression tests — out of scope for this feature.
- This is the [Testing Library recommended pattern](https://testing-library.com/docs/) for component styling: test behaviour (classes applied), not implementation detail (pixel values).

### Affected Tests (identified by scanning current test files)
| Test file | Current assertion | Replacement |
|---|---|---|
| `ConnectionStatus.test.jsx` | `toHaveStyle('background-color: #4caf50')` etc. | `toHaveClass('connection-status--connected')` etc. |
| `Toolbar.test.jsx` | `toHaveStyle('font-weight: bold')` (active tool) | `toHaveClass('toolbar__btn--active')` |

*(Canvas.jsx inline style for cursor/touchAction is excluded from refactor per spec — its test, if any, is not affected.)*

### Alternatives Considered
| Alternative | Rejected Because |
|---|---|
| Assert `toHaveStyle` with computed var value | JSDOM does not resolve CSS Custom Properties; tests would always fail |
| Use `getComputedStyle` + JSDOM manual CSS registration | Complex test setup boilerplate per test; brittle; masks real errors |
| Delete style-related tests | Loses coverage of connection status state behaviour; violates spec FR-011 intent |

---

## Topic 4: Token Naming Convention

### Decision
Use a **two-tier semantic naming system**:
1. **Primitive tokens** — raw values with descriptive names: `--color-indigo-600`, `--spacing-4`, `--font-size-sm`
2. **Semantic tokens** — purpose-named aliases: `--color-primary`, `--color-status-connected`, `--color-text-primary`

Components reference **only semantic tokens**. Primitive tokens exist as the source of semantic token values (defined in the same `:root` block).

### Rationale
- Semantic names decouple components from raw values (satisfies SC-002, SC-003).
- A colour palette swap only requires updating the primitive values — semantic aliases propagate automatically.
- Two tiers (not three) keeps complexity minimal for a 5-component app. A full design system with component-level tokens (tier 3) is unnecessary.

### Token Taxonomy

```
:root {
  /* === Primitives === */
  --indigo-600: #5c6bc0;
  --indigo-700: #3949ab;
  --gray-50:  #f8f9fa;
  --gray-100: #f1f3f4;
  --gray-200: #e0e0e0;
  --gray-600: #616161;
  --gray-900: #212121;
  --white:    #ffffff;
  --green-600: #4caf50;
  --orange-500: #ff9800;
  --red-500:  #f44336;
  --yellow-100: #fff3cd;
  --yellow-400: #ffc107;

  /* === Semantic: Color === */
  --color-primary:              var(--indigo-600);
  --color-primary-hover:        var(--indigo-700);
  --color-surface:              var(--gray-50);
  --color-surface-card:         var(--white);
  --color-border:               var(--gray-200);
  --color-text-primary:         var(--gray-900);
  --color-text-secondary:       var(--gray-600);
  --color-text-on-primary:      var(--white);
  --color-status-connected:     var(--green-600);
  --color-status-reconnecting:  var(--orange-500);
  --color-status-disconnected:  var(--red-500);
  --color-message-error:        var(--red-500);
  --color-message-warning:      var(--orange-500);
  --color-warning-surface:      var(--yellow-100);
  --color-warning-border:       var(--yellow-400);

  /* === Semantic: Spacing === */
  --spacing-xs: 0.25rem;   /*  4px */
  --spacing-sm: 0.5rem;    /*  8px */
  --spacing-md: 1rem;      /* 16px */
  --spacing-lg: 2rem;      /* 32px */

  /* === Semantic: Typography === */
  --font-family-base: 'Inter', system-ui, -apple-system, sans-serif;
  --font-family-mono: 'JetBrains Mono', 'Fira Code', monospace;
  --font-size-sm:   0.75rem;   /* 12px */
  --font-size-base: 1rem;      /* 16px */
  --font-size-lg:   1.25rem;   /* 20px */
  --font-size-xl:   2rem;      /* 32px */
  --font-weight-normal: 400;
  --font-weight-bold:   600;
  --line-height-base: 1.5;

  /* === Semantic: Shape === */
  --radius-sm:   4px;
  --radius-md:   6px;
  --radius-full: 9999px;
  --shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.08);
  --shadow-md: 0 2px 8px rgba(0, 0, 0, 0.12);
}
```

### Alternatives Considered
| Alternative | Rejected Because |
|---|---|
| Single tier (only semantic, no primitives) | Cannot swap palette — every token would need updating individually |
| Three tiers (primitive → alias → component) | Over-engineered for 5 components; adds indirection without clear value |
| Numeric scale suffixes (Tailwind style: `gray-50`) | Mixes primitive naming into semantic context; less readable |

---

## Topic 5: CSS Class Naming Convention

### Decision
Use **BEM-adjacent component-scoped naming**: `.component-name__element--modifier`. Each component's styles live in a dedicated file under `client/src/styles/components/`.

### Rationale
- BEM is widely understood and self-documenting; makes class purpose clear without reading component code (satisfies SC-004).
- Each component file is independently importable — matches Principle II (Modularity).
- 5 components do not warrant a utility-class system (Tailwind) or CSS Modules — the overhead would outweigh the benefit.
- No name collisions since every class is prefixed with the component name.

### Class Name Map

| Component | Root class | Key subclasses |
|---|---|---|
| `HomePage` | `.home-page` | `.home-page__title`, `.home-page__message--warning`, `.home-page__message--error`, `.home-page__divider`, `.home-page__join-row` |
| `RoomPage` | `.room-page` | `.room-page__header`, `.room-page__room-id`, `.room-page__canvas-area`, `.room-page__leave-btn` |
| `Toolbar` | `.toolbar` | `.toolbar__btn`, `.toolbar__btn--active` |
| `ConnectionStatus` | `.connection-status` | `.connection-status--connected`, `.connection-status--reconnecting`, `.connection-status--disconnected` |
| `ConfirmDialog` | `.confirm-dialog` | `.confirm-dialog__message`, `.confirm-dialog__actions` |

### Alternatives Considered
| Alternative | Rejected Because |
|---|---|
| CSS Modules | Requires Vite config change; generated class names break `toHaveClass` unless using the `identity-obj-proxy` mock |
| Utility classes (manual) | Need to be defined and maintained; harder for new contributors than BEM without a framework (Tailwind) enforcing them |
| Single global CSS file | No clear ownership per component; becomes unmanageable as app grows |
