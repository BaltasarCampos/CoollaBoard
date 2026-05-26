# Research: Participants Panel

**Feature**: `008-participants-panel`  
**Phase**: 0 — Research

---

## Decision 1: Display Name Strategy

**Question**: The current codebase assigns users a server-generated UUID (`userId`). The spec requires human-readable display names. How should names be introduced?

**Decision**: Add a **display-name input field** to the `HomePage` flow. The user types their name before creating or joining a room. The name is sent as `displayName` in the `room:create` and `room:join` socket payloads, stored in the server `sessions` map, and saved alongside the userId in each room's participant registry.

**Rationale**:
- A user-entered name directly satisfies the spec's examples ("Alice (You)", "Bob") without requiring a separate profile system.
- The homepage already has a text input (room ID) and form-button pattern — extending it with a name field is minimal UI work and fits existing conventions.
- Auto-generated names (e.g., "User-A1B2") would satisfy the technical requirement but degrade the collaborative experience; the spec implies real names.
- The spec assumption "User display names are already set before entering a room (handled by existing room join flow)" maps directly to the HomePage being the pre-room entry point.

**Alternatives considered**:
- **Random friendly names** (e.g., "Blue Dragon"): Removes user agency; not aligned with spec intent.
- **Persistent profile / localStorage**: Over-engineering for the current scope; no authentication exists.
- **Derive from UUID prefix**: Machine-unreadable; violates the spirit of a "participants panel".

**Constraints applied**:
- Display name: 1–30 characters, non-empty after trim.
- No special validation beyond length; any printable characters allowed (the canvas already handles arbitrary user content).

---

## Decision 2: Participant Event Design

**Question**: Should the server emit fine-grained events (`participant:joined`, `participant:left`) or a single full-list broadcast (`participants:updated`) on every membership change?

**Decision**: Use a **single `participants:updated` event** that carries the full current participant list as `Array<{ userId, displayName }>`.

**Rationale**:
- Full-list broadcasts are idempotent and inherently convergent (Constitution Principles IV & V). Applying the same event twice yields the same panel state, and all clients converge regardless of message order or missed events.
- Fine-grained events require clients to maintain a local copy and apply incremental patches correctly — difficult to keep in sync after reconnects or missed messages.
- The participant list is small (typically < 100 entries); broadcasting the full array is negligible overhead.
- On reconnect, the `room:join` acknowledgement already returns the current state, so the client gets the authoritative list without subscribing to a replay queue.

**Alternatives considered**:
- **`participant:joined` + `participant:left`**: More granular, but adds patch logic on the client and risks de-sync after network interruptions.
- **Include participants in `room:state`** only: Works for the initial load, but leaves real-time updates without a mechanism.

---

## Decision 3: Server Storage for Display Names

**Question**: Where should display names be stored on the server?

**Decision**: Add a `userDisplayNames: Map<userId, displayName>` field to each **room object** in `roomService.js`, and also store `displayName` in the per-socket `sessions` map entry.

**Rationale**:
- The room object already owns `connectedUsers: Set<userId>`; a parallel `userDisplayNames` Map keeps display name lookup O(1) by userId without restructuring `connectedUsers`.
- The `sessions` map entry (`{ userId, roomId }`) gains a `displayName` field — needed so the `disconnect` handler can log the departing user's name and include it in post-removal broadcasts.
- A helper `getParticipants(roomId)` on `roomService.js` returns `Array<{ userId, displayName }>` ordered by join time, abstracting the Map iteration from handler code.

**Alternatives considered**:
- **Replace `connectedUsers: Set` with `Map<userId, displayName>`**: Cleaner, but requires updating all callers that currently reference `room.connectedUsers` as a Set — higher blast radius.
- **Store only in sessions map**: The sessions map is keyed by `socket.id`, not `userId`; cross-referencing it from `roomService` would violate Loose Coupling (Principle VI).

---

## Decision 4: Loading State

**Question**: How should the panel behave before the initial participant list arrives?

**Decision**: `useParticipants` initialises `participants` as `null` and `isLoading` as `true`. The hook transitions to `isLoading: false` only after either:
1. The `participants:updated` event is received for the current room, OR
2. The initial participants list is injected directly from the `room:join`/`room:create` acknowledgement (passed as prop/param to the hook).

`ParticipantsPanel` renders a `"Loading…"` text when `isLoading` is true, matching the edge-case requirement in the spec ("loading indicator (spinner, skeleton, or 'Loading…' text)").

**Rationale**:
- Injecting the initial list from the join ack (already available synchronously before the component mounts) eliminates the flash of the loading state in most cases.
- The null-initial / loading-flag pattern is idiomatic in this codebase (matches `CONNECTION_STATUS` approach in `useRoom`).

---

## Decision 5: Component Placement & Layout

**Question**: Where does `ParticipantsPanel` live in the RoomPage layout?

**Decision**: `ParticipantsPanel` is a **sibling of `.room-page__canvas-area`** inside `.room-page`, rendered as a fixed-width right sidebar. The `.room-page` flex column becomes a row at the content level, with `.room-page__canvas-area` taking `flex: 1` and the panel taking a fixed width of `220px`. The panel has `overflow-y: auto` and a fixed `height` derived from the viewport minus the header.

**Rationale**:
- Mirrors the structure described in FR-001: "fixed sidebar on the right side of the layout".
- Keeps canvas area width computation simple (flex residual, no absolute positioning).
- Placing the panel inside `.room-page` (rather than `.room-page__canvas-area`) avoids z-index conflicts with the canvas overlay.

**Alternatives considered**:
- **Absolute-positioned overlay**: Covers canvas content; violates the "always visible" requirement.
- **Inside `.room-page__canvas-area`**: Would require changing the canvas-area's `position: relative; overflow: hidden` and potentially clipping the panel.
