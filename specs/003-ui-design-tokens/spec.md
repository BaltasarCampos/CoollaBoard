# Feature Specification: UI Design Tokens & Modern Restyle

**Feature Branch**: `003-ui-design-tokens`  
**Created**: 2026-05-15  
**Status**: Draft  
**Input**: User description: "Extract inline styles or rigid layout constraints into reusable CSS classes or design tokens. Restyle the app aesthetics to look simple, light and modern"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Consistent Visual Experience (Priority: P1)

A user opening CoollaBoard for the first time sees a clean, light, and modern interface across every screen. Colors, typography, spacing, and interactive states all feel cohesive — nothing looks out of place or mismatched.

**Why this priority**: Visual consistency is the most immediate and impactful outcome of this feature. If the design system is in place, every screen benefits automatically. This is the foundation for all other stories.

**Independent Test**: Can be fully tested by loading the Home Page and the Room Page in a browser and visually confirming that fonts, colors, spacing, and button styles are consistent and modern without requiring any additional stories to be implemented.

**Acceptance Scenarios**:

1. **Given** a user navigates to the Home Page, **When** the page loads, **Then** the page uses a light background, clean sans-serif typography, and clearly styled interactive elements with no visual clutter.
2. **Given** a user joins a room, **When** the Room Page renders, **Then** the toolbar, canvas area, header bar, and connection badge all share the same color palette and spacing system as the Home Page.
3. **Given** a user sees an error or info message, **When** the message appears, **Then** the message uses a visually distinct but harmonious style (not raw HTML defaults) consistent with the overall aesthetic.

---

### User Story 2 - Maintainable Style Source of Truth (Priority: P2)

A developer updating or extending the UI can change a color, spacing value, or font in a single location and see that change reflected everywhere in the app without manually hunting through component files.

**Why this priority**: This is the structural goal behind the feature — eliminating scattered inline styles and consolidating values into reusable tokens or classes. Without this, every future style change risks inconsistency.

**Independent Test**: Can be fully tested by changing a single token value (e.g., primary brand color or base spacing unit) and confirming the change propagates to all affected UI elements across both the Home Page and Room Page.

**Acceptance Scenarios**:

1. **Given** inline styles exist in multiple components, **When** the refactor is complete, **Then** no component contains hardcoded layout or color values as inline style props — all visual declarations are expressed through external classes or named tokens.
2. **Given** the design token source is updated with a new primary color value, **When** the app is reloaded, **Then** every element that uses that color reflects the new value without any individual component code changes.
3. **Given** a developer adds a new component, **When** they apply the existing token or class system, **Then** the new component automatically matches the app's visual language.

---

### User Story 3 - Accessible and Clear Interactive States (Priority: P3)

A user interacting with buttons, inputs, and tool selectors can clearly tell which element is active, hovered, focused, or disabled — without relying on browser defaults.

**Why this priority**: This story builds on Story 1 and Story 2. Once tokens are established, interactive states should be explicitly designed rather than inherited from browser defaults.

**Independent Test**: Can be fully tested by tabbing through both pages (Home Page and Room Page) and clicking each interactive element to confirm focus rings, hover highlights, active states, and disabled states all render with intentional, consistent styling.

**Acceptance Scenarios**:

1. **Given** a user hovers over a button, **When** the pointer moves over it, **Then** a visible hover state is applied (color change, shadow, or outline) that differs from the resting state.
2. **Given** a drawing tool is selected in the toolbar, **When** the active tool changes, **Then** the active tool button displays a clearly distinct visual state compared to inactive tools.
3. **Given** an input field is focused, **When** the user tabs or clicks into it, **Then** a visible focus ring appears that is styled consistently with the app's design language (not a raw browser default outline).
4. **Given** a button or input is disabled, **When** the element is in its disabled state, **Then** it appears visually muted with reduced opacity or a clearly subdued style.

---

### Edge Cases

- What happens when the connection status badge overlaps interactive content on small screens? → The primary design target is ≥ 1024px (desktop-first). Below that, the badge must remain visible and non-overlapping with critical controls, but no full mobile reflow is required.
- How does the styled confirm dialog align with the toolbar when displayed inline? → `ConfirmDialog` is rendered conditionally inside the toolbar's containing view; its `.confirm-dialog` class uses `display: inline-flex` which flows inline within the header's flex row without disrupting toolbar layout. No extra positioning is required.
- How are message states (info in orange, error in red) handled once raw color values are replaced with semantic tokens — do the semantic names survive a color palette change?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: All inline `style` props in React components MUST be removed and replaced with CSS class-based or token-based styling. Compliance MUST be enforced by an ESLint rule (`react/forbid-component-props` targeting `style`) that runs in CI, preventing new inline styles from being merged.
- **FR-002**: A shared design token set MUST define the app's core values: color palette (including `--color-primary` as the single brand accent color, semantic status colors, and neutral grays), spacing scale, typography (font family, sizes, weights), border radii, and shadow levels. Tokens MUST be expressed as CSS Custom Properties (`--var-name`) in a global CSS file applied at the `:root` level, and consumed via `var(--var-name)` inside CSS class rules.
- **FR-003**: Color tokens MUST include: (a) a single primary brand color (`--color-primary`, e.g., indigo or blue-gray) used for buttons, active tool highlight, and focus rings; (b) semantic status names (`--color-status-connected`, `--color-status-reconnecting`, `--color-status-disconnected`); (c) semantic message names (`--color-message-error`, `--color-message-warning`); and (d) neutral surface/text values. Components MUST reference semantic names, not raw hex values.
- **FR-004**: The Home Page MUST display with a centered, calm layout using a light neutral background, clear heading hierarchy, and styled form controls (input and buttons).
- **FR-005**: The Room Page header bar MUST use a styled layout with a clear visual separation from the canvas area, using tokens for padding, border color, and typography.
- **FR-006**: The Toolbar MUST display active tool selection using a visually distinct state derived from the token system, not ad-hoc inline weight toggles.
- **FR-007**: The Connection Status badge MUST use semantic color tokens (`connected`, `reconnecting`, `disconnected`) and maintain its pill shape and fixed position styling through externalized CSS.
- **FR-008**: The Confirm Dialog MUST use the shared warning/alert tokens rather than hardcoded hex color values.
- **FR-009**: The design token set MUST be defined in a single global CSS file (e.g., `tokens.css`) that is imported once at the application entry point, making all `--var-name` custom properties available to every component via the CSS cascade.
- **FR-010**: Interactive states (hover, focus, active, disabled) for all buttons and inputs MUST be explicitly styled using the token system. Focus rings and active highlights MUST use `--color-primary`. Disabled states MUST use reduced opacity or a muted neutral token.
- **FR-011**: Any existing unit or integration test that asserts against hardcoded inline style values (e.g., `toHaveStyle('color: red')`) MUST be updated within this feature to assert against CSS class names or computed CSS property values instead, ensuring the test suite remains green after the inline style refactor.

### Key Entities

- **Design Token**: A named CSS Custom Property (e.g., `--color-primary`, `--spacing-md`) defined once in a global `:root` block and referenced everywhere via `var(--var-name)`. Tokens are grouped into: color, spacing, typography, shape.
- **Semantic Token**: A higher-level token whose name describes its purpose rather than its value (e.g., `--color-status-disconnected` rather than `#f44336`, or `--color-message-error` for error message text).
- **CSS Class**: A named style rule applied to elements via `className`, encapsulating layout or visual properties extracted from inline styles.
- **Component Style Contract**: The agreed-upon set of classes and tokens a component is expected to use — no private inline overrides allowed after the refactor.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Zero inline `style` prop occurrences remain in production component files after the refactor is complete. This is verified by an ESLint lint rule (`react/forbid-component-props` targeting `style`) that passes with zero violations in CI.
- **SC-002**: All color values used in the UI can be traced back to a named token within a single design token definition file.
- **SC-003**: Changing any single design token value results in a consistent visual update across all components that reference it, with no additional code changes required.
- **SC-004**: A new contributor can apply the correct visual style to a new component by referencing only the token/class system, without reading any existing component source.
- **SC-005**: The restyled app achieves a clean, uncluttered appearance — stakeholders reviewing the UI describe it as "simple", "modern", and "light" with no raw-HTML-default elements visible.
- **SC-006**: All interactive elements (buttons, inputs, tool buttons) have visible and intentional hover, focus, active, and disabled states — none fall back to browser-default styling.
- **SC-007**: The full unit and integration test suite passes with zero failures after the inline style refactor; no tests are skipped or commented out as a result of this feature.

## Clarifications

### Session 2026-05-15

- Q: How should design tokens be delivered and consumed across components? → A: CSS Custom Properties — tokens defined as `--var-name` in a `:root` block in a global CSS file; components consume via `var(--var-name)` in their class rules.
- Q: What is the responsive / screen-size scope for this restyle? → A: Desktop-first with a minimum viable mobile guard — primary design targets ≥ 1024px; the UI must not have overlapping or clipped elements below that, but no full mobile layout is required.
- Q: How should SC-001 (zero inline `style` props) be enforced? → A: ESLint lint rule (`react/forbid-component-props` targeting `style`) enforced in CI.
- Q: Should there be a brand/primary color token for interactive elements? → A: Yes, one primary brand color token — `--color-primary` (indigo or blue-gray) used for buttons, active tool highlight, and focus rings.
- Q: Should existing tests asserting inline style values be updated in this feature or deferred? → A: Update tests in this feature — any test asserting inline style values is updated to assert against class names or computed CSS values instead.

## Assumptions

- The app uses a browser-based, component-driven architecture. Design tokens are delivered as CSS Custom Properties in a global stylesheet — no CSS-in-JS or preprocessor (SCSS) is required.
- "Light" aesthetic means a predominantly white or near-white background with dark text and neutral/soft accents — not a dark mode.
- "Modern" means clean sans-serif typography, consistent rounding on interactive elements, subtle shadows or borders for elevation, and no skeuomorphic design.
- "Simple" means removing visual noise — no gradients, excessive borders, or decorative elements beyond what aids usability.
- Dark mode support is out of scope for this feature but the token system MUST be structured to accommodate it as a future extension without breaking changes.
- The primary design target is desktop viewports ≥ 1024px. The UI must not exhibit overlapping or clipped elements on narrower viewports, but a full responsive mobile layout is out of scope.
- The canvas element itself (drawing surface) is excluded from the restyle — its cursor and touch behavior are functional, not aesthetic.
- Existing component behavior, socket connectivity, and test logic MUST remain unchanged; only visual styling and test assertions on style values are in scope.
- The `shared/` package (constants, types) is out of scope for this feature; it is addressed by feature `002`.
