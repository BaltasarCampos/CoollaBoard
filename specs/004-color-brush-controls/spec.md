# Feature Specification: Color Picker and Brush Size Controls

**Feature Branch**: `004-color-brush-controls`  
**Created**: 2026-05-16  
**Status**: Draft  
**Input**: User description: "Create color picker and brush size controls"

## Clarifications

### Session 2026-05-16

- Q: How should brush size be stored in each stroke for syncing and rendering? → A: Store brushSize as numeric width value in each stroke.
- Q: What brush preset widths should be used? → A: Small = 2, Medium = 4, Large = 8.
- Q: How should invalid incoming stroke color/size values be handled? → A: Keep the stroke and fall back to default color and default brush size.
- Q: Which stroke colors should be accepted? → A: Accept only colors from the predefined toolbar palette.
- Q: What is the default drawing color value? → A: #111111.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Choose a Drawing Color (Priority: P1)

A user in a drawing room wants to express different ideas using distinct colors. They open the toolbar and select a color from the available color options. From that point forward, every stroke they draw appears in the chosen color — both on their own canvas and on every other participant's screen.

**Why this priority**: Color selection is the most visible and immediately impactful drawing customization. It directly enables multi-color sketches and distinguishes each collaborator's contributions. Without it, all users must draw in the same default color, severely limiting expressiveness.

**Independent Test**: Can be fully tested by one user selecting a non-default color and drawing a stroke, then confirming the stroke appears in the selected color on the same screen. The collaborative aspect (other users seeing the color) can be verified independently in a two-tab scenario.

**Acceptance Scenarios**:

1. **Given** a user is in a room with the pen tool active, **When** they select a color from the toolbar's color picker and draw a stroke, **Then** the stroke appears on the canvas in the selected color.
2. **Given** a user has selected a non-default color, **When** another participant is in the same room, **Then** that participant's canvas also renders the stroke in the correct color the originating user selected.
3. **Given** a user with a custom color selected switches to the eraser tool and then back to the pen tool, **When** they draw a new stroke, **Then** the stroke uses the same color that was selected before the tool switch — the color selection is preserved.
4. **Given** a new user joins a room that already has colored strokes on the canvas, **When** the canvas state loads, **Then** the existing strokes each display in the color they were originally drawn in.

---

### User Story 2 - Adjust Brush Thickness (Priority: P2)

A user wants to vary the visual weight of their strokes — using a fine line for detailed annotations and a thick line for bold highlights. They select a brush size from the toolbar before drawing. Every stroke they create from that moment uses the chosen thickness, and all other room participants see the stroke at the same size.

**Why this priority**: Brush size control complements color selection and significantly improves drawing quality. It enables labeling, diagramming, and emphasis that are impossible with a single fixed line weight. It depends on the same stroke metadata mechanism as color.

**Independent Test**: Can be fully tested by selecting a non-default brush size, drawing a stroke, and confirming the visual width differs from the default stroke width. No other user story is required to test this independently.

**Acceptance Scenarios**:

1. **Given** a user is in a room with the pen tool active, **When** they select a brush size from the toolbar's size control and draw a stroke, **Then** the stroke renders visibly thicker or thinner than the default size depending on the selection made.
2. **Given** a user selects a large brush size and draws, **When** another participant views the same room, **Then** the stroke appears at the same large width on their canvas.
3. **Given** a user has selected a non-default brush size, **When** they switch to the eraser tool and then back to the pen tool, **Then** the brush size is still set to their previous selection — it is not reset by the tool switch.
4. **Given** a new user joins a room with existing strokes of varying thicknesses, **When** the canvas renders the historical state, **Then** each stroke appears at its original drawn thickness.

---

### User Story 3 - Default Drawing State on Room Entry (Priority: P3)

A user entering any drawing room for the first time sees that the toolbar's color and brush size controls are pre-set to sensible defaults (a neutral drawing color and a mid-range stroke width). They can immediately start drawing without needing to configure any settings.

**Why this priority**: Default state ensures no user is blocked from drawing immediately. This is the lowest priority because the default values are invisible to users who simply start drawing, but they matter for first-time and casual users.

**Independent Test**: Can be tested by entering a room without interacting with color or size controls, drawing a stroke, and confirming it uses an expected default color (black or near-black) and a visibly medium weight — without any toolbar interaction required.

**Acceptance Scenarios**:

1. **Given** a user enters a room without changing any toolbar settings, **When** they draw with the pen tool, **Then** the stroke uses the default color (a neutral, dark drawing color) and the default brush size (a visibly medium weight).
2. **Given** two users join a fresh room and both draw without adjusting settings, **When** both strokes render, **Then** both appear visually identical in color and weight because the default is the same for all users.

---

### Edge Cases

- What happens when a stroke arrives from a remote user without color or brush size metadata (e.g., from an older client)? The canvas renderer falls back to the default color and default brush size, so the stroke still renders correctly.
- What happens when a stroke arrives with invalid color or brush size values? The stroke is still rendered, but invalid values are normalized to defaults (default color and default size).
- What if a user rapidly switches colors and draws many strokes in succession? Each stroke carries its own color since color is recorded at the time the stroke is committed — rapid switching produces correctly colored strokes with no bleed-over.
- What happens to strokes drawn before this feature existed (no color/size in their data)? They render using the default color and default brush size — no visual corruption or errors occur.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The toolbar MUST provide a color selection control that allows a user to choose a drawing color from a predefined set of at least 8 distinct colors, including default near-black color `#111111`.
- **FR-001a**: Stroke colors MUST be restricted to the predefined toolbar palette; custom or arbitrary color strings are out of scope for this feature.
- **FR-002**: The toolbar MUST provide a brush size selection control with exactly 3 discrete size options mapped to numeric widths: small = 2, medium = 4, large = 8.
- **FR-003**: When the user draws a stroke with the pen tool, the stroke MUST use the color and brush size currently selected in the toolbar at the moment the stroke is committed (pointer released).
- **FR-004**: The selected color and numeric brush width MUST be included in the stroke data transmitted to all room participants, so that remote canvases render each stroke with its originating user's exact color and thickness.
- **FR-005**: The canvas renderer MUST use each stroke's color and numeric brush width when drawing that stroke, rather than a single global setting, so that historically received strokes each render with their own original appearance.
- **FR-006**: The eraser tool MUST NOT be influenced by the color selection. Erasing behavior is defined solely by eraser-specific parameters.
- **FR-007**: The user's selected color and brush size MUST persist in the toolbar across tool switches within the same session (switching pen → eraser → pen retains prior color and size).
- **FR-008**: On room entry, the color selector MUST default to `#111111` and the brush size selector MUST default to medium (4). Users can begin drawing immediately with sensible defaults.
- **FR-009**: If incoming stroke data is missing or has invalid color or numeric brush width fields (e.g., strokes from a prior version or malformed payloads), the renderer MUST keep the stroke and fall back to the default color and default brush size — no rendering error or canvas corruption should occur.
- **FR-010**: The existing test suite MUST remain green after this feature is implemented. Any tests that reference fixed stroke color or brush size values MUST be updated to reflect the new parameterized behavior.

### Key Entities

- **Stroke**: A completed freehand path drawn by a user. In addition to existing attributes (operation ID, sequence number, timestamp, points array), a stroke now carries `color` (a specific drawing color chosen by the user) and `brushSize` (numeric stroke width at the time of drawing). The eraser operation type is unaffected.
- **Toolbar Drawing State**: The per-user, session-scoped state that holds the currently selected color and brush size. It is initialized to defaults on room entry and updated via toolbar controls. It is not persisted across sessions.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can draw in at least 8 distinct colors selectable from the toolbar without any page reload or external tool.
- **SC-002**: A user can select from at least 3 visually distinct brush sizes from the toolbar, producing strokes that differ noticeably in width.
- **SC-003**: All participants in the same room see each stroke in the originating user's selected color and at the correct brush size within the same real-time latency window as other drawing updates.
- **SC-004**: A user's color and brush size selection is not lost when they switch from the pen tool to the eraser and back — confirmed by drawing a test stroke after the round-trip switch.
- **SC-005**: Strokes drawn before this feature (without color/size metadata) continue to render without errors, using the default color and size as fallback.
- **SC-006**: A new user who enters a room without touching any toolbar controls can immediately draw a stroke using the default settings — confirmed by drawing a stroke with zero toolbar interaction.

## Assumptions

- Users are drawing on a desktop browser; the color picker and brush size controls are designed for pointer/mouse input. Touch support is not a new requirement introduced by this feature.
- The predefined color set is fixed (e.g., black, white, red, orange, yellow, green, blue, purple, plus optionally a few neutrals). A fully open color wheel is not required for this feature version.
- The default drawing color is fixed to `#111111`.
- Brush size options are a small set of discrete presets (3–5 choices), not a continuous slider. Each preset maps to a numeric width value stored per stroke.
- The brush preset mapping is fixed for this feature: small = 2, medium = 4, large = 8.
- The brush size unit is relative to the virtual canvas coordinate space already used in the drawing system — visual weight scales proportionally across different screen sizes.
- The eraser tool retains its own fixed radius; the brush size control applies only to the pen tool.
- Color and brush size selections are not persisted across browser sessions or page reloads — they reset to defaults on each room entry.
- No per-user color assignment or "who drew this" attribution is required by this feature. Color is purely a user-chosen drawing expression tool.
- The server acts as a transparent relay for stroke data — it stores and forwards color and brush size as part of stroke payloads without validation or modification of those fields.
