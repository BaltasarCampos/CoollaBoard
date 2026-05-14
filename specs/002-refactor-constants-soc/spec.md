# Feature Specification: Codebase Refactor — Constants & Separation of Concerns

**Feature Branch**: `002-refactor-constants-soc`  
**Created**: 2026-05-14  
**Status**: Draft  
**Input**: User description: "refactor the code base to make sure no hardcode value is used where a constant value from /shared/constants.js can be used instead. Refactor the basecode to comply with separation of concerns. Separate business logic from presentation at components"

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Application Behaves Identically After Refactor (Priority: P1)

As a developer maintaining the CoollaBoard codebase, I want all visible application behaviour to remain completely unchanged after the refactor, so that no regressions are introduced while the internal code quality improves.

**Why this priority**: The primary risk of a refactoring task is breaking existing behaviour. Verifying that nothing regresses is the highest-value gate.

**Independent Test**: Run the full existing test suite (unit, integration, and E2E) and confirm all tests continue to pass without modification.

**Acceptance Scenarios**:

1. **Given** the codebase before refactoring, **When** all automated tests are executed, **Then** every test passes; after refactoring is complete, **When** all tests are executed again, **Then** every test still passes with no test changes required.
2. **Given** the running application after the refactor, **When** a user creates a room, joins a room, draws, erases, and clears the canvas, **Then** all actions work exactly as before.
3. **Given** the running application, **When** the server connection drops and reconnects, **Then** the client reconnects and delta-hydrates missed operations as before.

---

### User Story 2 — No Magic Literals in Code That Duplicate a Shared Constant (Priority: P2)

As a developer reading any file in the codebase, I want every value that is already defined in `shared/constants.js` (or should be defined there) to be referenced by its named constant, so that changes to those values require editing only one place.

**Why this priority**: Duplicate literals are the root cause of hard-to-track bugs when values change; eliminating them builds on the already-existing constants module.

**Independent Test**: A code review (or automated linting rule) confirms that no string literal, numeric literal, or regex pattern duplicates a value already expressible via `shared/constants.js`.

**Acceptance Scenarios**:

1. **Given** the `HomePage` component, **When** it validates a room ID, **Then** the length check uses `ROOM_ID_LENGTH` and the character-set check uses `ROOM_ID_ALPHABET` from `shared/constants.js` — no inline `6` or `[A-Z0-9]` magic literal appears.
2. **Given** any component or tool that identifies the active drawing tool, **When** comparing or storing a tool name, **Then** it uses a named constant (e.g., `TOOL_NAMES.PEN`, `TOOL_NAMES.ERASER`) from `shared/constants.js` rather than bare string literals.
3. **Given** any file that handles connection status values (`'Connected'`, `'Reconnecting'`, `'Disconnected'`), **When** those strings appear, **Then** they are replaced by named constants defined in `shared/constants.js`.
4. **Given** server-side event handlers, **When** emitting error codes such as `'ROOM_NOT_FOUND'` or `'SERVER_ERROR'`, **Then** those strings reference named constants from `shared/constants.js`.
5. **Given** `shared/constants.js` is extended with the new constant groups above, **When** any new constant duplicates a value already used elsewhere, **Then** all existing usages are updated.

---

### User Story 3 — Business Logic Separated from Presentation in All Components (Priority: P3)

As a developer working on a component, I want presentation files to contain only rendering and user-interaction coordination, while all state management, service calls, validation, and socket interactions live in dedicated hooks or utilities, so that each layer can be understood and tested in isolation.

**Why this priority**: Separation of concerns improves long-term maintainability and testability; it follows naturally once constants are in place.

**Independent Test**: Each refactored component can be tested as a pure presentational unit using props alone, without mocking services or socket calls; all the extracted hooks/utilities can be unit-tested independently.

**Acceptance Scenarios**:

1. **Given** the `HomePage` component, **When** a developer reads it, **Then** it delegates all room-creation, room-joining, and input-validation logic to a dedicated hook (e.g., `useHomePage`) and contains only JSX and event-binding code.
2. **Given** the `RoomPage` component, **When** a developer reads it, **Then** it delegates socket reconnect handling and delta-hydration to the existing `useRoom` hook or a new focused hook, and retains only layout and tool-switching logic.
3. **Given** the `Canvas` component, **When** a developer reads it, **Then** rendering logic (draw/erase/clear routines) is extracted into a canvas-rendering utility or hook, and the component is responsible only for JSX structure and event forwarding.
4. **Given** any extracted hook, **When** unit-tested in isolation, **Then** the test requires no DOM or React component and exercises only the logic.
5. **Given** the `Toolbar` component, **When** a developer reads it, **Then** the canvas-clear operation (operationId generation, socket emission) is delegated to the hook layer rather than called directly inside the component handler.

---

### Edge Cases

- What happens if `shared/constants.js` is extended with a constant whose value happens to collide with an unrelated existing literal elsewhere in the codebase? The refactor must ensure only intentional usages are replaced.
- How does the system handle a tool name that has not yet been mapped to a constant (e.g., a future tool added after the refactor)? The constants file must document that all tool identifiers must be declared there.
- What happens if the extracted hook for `HomePage` validation is given an input shorter or longer than `ROOM_ID_LENGTH`? The hook must still enforce the same validation rules as today.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST define new constant groups in `shared/constants.js` for: tool name identifiers (`TOOL_NAMES`), connection status values (`CONNECTION_STATUS`), and error code strings (`ERROR_CODES`).
- **FR-002**: The system MUST replace every inline string or numeric literal in the client and server codebase that corresponds to a value expressible via an existing or newly added constant in `shared/constants.js`.
- **FR-003**: The `HomePage` component MUST delegate room-ID validation logic (length check against `ROOM_ID_LENGTH`, character-set check derived from `ROOM_ID_ALPHABET`), room creation, and room joining to a dedicated `useHomePage` hook.
- **FR-004**: The `RoomPage` component MUST delegate socket reconnect and delta-hydration logic, and the canvas-clear emission (`emitClear` + `operationId` generation), to the `useRoom` hook (or a focused extension of it), retaining only layout and tool-state coordination inside the component. `RoomPage` MUST NOT import from `../services/socket.js`.
- **FR-005**: The `Canvas` component MUST extract its canvas rendering routines (`renderDraw`, `renderErase`), the `requestAnimationFrame` render loop, `dirtyRef` tracking, and `ResizeObserver` resize handling into a dedicated **custom hook** (`useCanvasRenderer`) located at `client/src/hooks/useCanvasRenderer.js`, retaining only JSX and pointer-event forwarding in the component.
- **FR-006**: The `Toolbar` component MUST delegate the canvas-clear flow (operationId generation, service call) to the hook layer, so the component only coordinates user interaction.
- **FR-007**: The refactored codebase MUST pass the entire existing automated test suite (unit, integration, and E2E) without any test modifications.
- **FR-008**: No new behaviour, new features, or performance optimisations MUST be introduced — this is a pure structural refactor.

### Key Entities

- **Shared Constants (`shared/constants.js`)**: The single source of truth for all named values shared across client and server. After refactoring it will include tool names, connection status strings, and error codes in addition to its current content.
- **Presentational Component**: A React component whose responsibility is exclusively JSX structure and user-interaction event delegation. Contains no direct service calls, socket interactions, or complex business-logic computations.
- **Logic Hook**: A React custom hook (files under `client/src/hooks/`) that owns state management, service calls, validation, and socket subscriptions. Independently unit-testable without a rendered DOM.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of the existing automated tests pass before and after the refactor without modification — zero regressions.
- **SC-002**: Zero occurrences of the raw string literals `'pen'`, `'eraser'`, `'Connected'`, `'Reconnecting'`, `'Disconnected'`, `'ROOM_NOT_FOUND'`, `'SERVER_ERROR'` remain as bare literals in **production source files** (`client/src/**`, `server/src/**`, `shared/`) outside of `shared/constants.js` after the refactor. Existing test files (`*.test.js`, `*.test.jsx`) and E2E specs are exempt from this rule; new test files for extracted hooks should prefer constants but are not required to.
- **SC-003**: Zero occurrences of the numeric literal `6` **when used as the room-ID length** (e.g., `length !== 6`, `{6}` inside a regex quantifier scoped to room-ID validation, `maxLength={6}`) remain outside `shared/constants.js`. Numeric literals that equal `6` in unrelated contexts (test data, CSS values, array indices, unrelated counters) are explicitly out of scope.
- **SC-004**: Each refactored component (`HomePage`, `RoomPage`, `Canvas`, `Toolbar`) contains no direct imports from `../services/socket.js` — all socket interactions are mediated by hooks. This is an absolute rule: no component in the list is exempt, including page-level containers such as `RoomPage`.
- **SC-005**: Each extracted logic hook (`useHomePage`, `useCanvasRenderer`, and any other hook newly created by this refactor) MUST have at least one dedicated unit test file that exercises its behaviour without mounting a React component. These test files are **mandatory deliverables** of this refactor, not optional. Existing test files must not be modified.

## Assumptions

- The existing test suite covers the critical paths of room creation, room joining, drawing, erasing, and canvas clearing — **no existing test files require modification** as part of this refactor. New test files for extracted hooks are mandatory (see SC-005).
- The `shared/constants.js` file is the authoritative location for all shared literals; no new separate constants files will be created in this refactor.
- The server-side code (`server/`) is already well-structured in terms of separation of concerns and requires only constant-substitution updates, not structural restructuring.
- Inline styles within components are outside the scope of this refactor; only logic and constant literals are addressed.
- The socket server URL (e.g., `http://localhost:3001`) is considered environment-specific configuration rather than a shared constant and is out of scope for this refactor.

## Clarifications

### Session 2026-05-14

- Q: SC-005 (new hook tests mandatory) vs. Assumption (no new tests needed) — which governs? → A: SC-005 is a hard requirement; new unit test files for each extracted hook are mandatory deliverables. The Assumption applies only to existing test files (none may be modified).
- Q: FR-005 — should the Canvas rendering extraction be a custom hook or a utility module? → A: Custom hook (`useCanvasRenderer` at `client/src/hooks/useCanvasRenderer.js`). The RAF loop, `dirtyRef`, and `ResizeObserver` require component lifecycle management that only a hook can cleanly own.
- Q: SC-004 — does `RoomPage` retain a socket import for `emitClear` or must it also be clean? → A: SC-004 is absolute for all four components including `RoomPage`. `emitClear` and `operationId` generation move into `useRoom` (or a focused extension); `RoomPage` imports no socket service directly.
- Q: SC-003 — is the ban on numeric literal `6` blanket or contextual? → A: Contextual. Only occurrences of `6` used as the room-ID length (validation logic, regex quantifiers, input `maxLength`) must be replaced with `ROOM_ID_LENGTH`. Unrelated uses of the number 6 are out of scope.
- Q: SC-002 — does the magic-literal ban apply to test files or production source only? → A: Production source only (`client/src/**`, `server/src/**`, `shared/`). Existing test files and E2E specs are exempt. New hook test files should prefer constants but are not required to.
