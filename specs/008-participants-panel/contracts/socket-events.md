# Socket Event Contracts: Participants Panel

**Feature**: `008-participants-panel`  
**Direction key**: C→S = client to server | S→C = server to client

---

## Modified Event: `room:create` (C→S)

**Existing event; payload extended.**

### Payload (client → server)
```jsonc
{
  "displayName": "Alice"   // NEW: string, 1–30 chars, trimmed
}
```

### Acknowledgement (server → client) — extended
```jsonc
{
  "ok": true,
  "roomId": "AB12CD",
  "userId": "uuid-v4",
  "participants": [          // NEW: full participant list at time of creation
    { "userId": "uuid-v4", "displayName": "Alice" }
  ]
}
```

**Error ack** (unchanged):
```jsonc
{ "ok": false, "error": "SERVER_ERROR", "message": "Failed to generate room" }
```

---

## Modified Event: `room:join` (C→S)

**Existing event; payload extended.**

### Payload (client → server)
```jsonc
{
  "roomId": "AB12CD",
  "displayName": "Bob",     // NEW: string, 1–30 chars, trimmed
  "lastSequence": 0          // existing, optional
}
```

### Acknowledgement (server → client) — extended
```jsonc
{
  "ok": true,
  "userId": "uuid-v4",
  "operations": [ /* existing canvas operations array */ ],
  "participants": [          // NEW: full participant list after join
    { "userId": "uuid-v4-alice", "displayName": "Alice" },
    { "userId": "uuid-v4-bob",   "displayName": "Bob"   }
  ]
}
```

**Error ack** (unchanged):
```jsonc
{ "ok": false, "error": "ROOM_NOT_FOUND", "message": "Room AB12CD does not exist" }
```

---

## New Event: `participants:updated` (S→C)

**Broadcast to all room members** whenever a user joins or leaves the room (including the joining user themselves).

### Payload
```jsonc
{
  "participants": [
    { "userId": "uuid-v4-alice", "displayName": "Alice" },
    { "userId": "uuid-v4-bob",   "displayName": "Bob"   }
  ]
}
```

**Trigger points**:
1. After a user successfully joins a room via `room:join` — broadcast to the **entire room** (including the new joiner via `io.to(roomId).emit`).
2. After a user disconnects — broadcast to the **remaining room members** (via `socket.to(roomId).emit`) with the updated list (departing user already removed).
3. After a user successfully creates a room via `room:create` — emitted only to the creating socket (single-user initial state).

**Shared constant**: `SERVER_EVENTS.PARTICIPANTS_UPDATED = 'participants:updated'`

---

## Unchanged Events

The following existing events are unaffected by this feature:

| Event | Direction | Status |
|---|---|---|
| `draw:stroke` | C→S | Unchanged |
| `canvas:clear` | C→S | Unchanged |
| `stroke:preview` | C→S | Unchanged |
| `stroke:cancel` | C→S | Unchanged |
| `undo:request` | C→S | Unchanged |
| `redo:request` | C→S | Unchanged |
| `room:created` | S→C | Unchanged |
| `room:state` | S→C | Unchanged |
| `draw:broadcast` | S→C | Unchanged |
| `canvas:cleared` | S→C | Unchanged |
| `room:error` | S→C | Unchanged |
| `stroke:preview:broadcast` | S→C | Unchanged |
| `stroke:cancel:broadcast` | S→C | Unchanged |
| `user:left` | S→C | Unchanged (still emitted; participant panel uses `participants:updated` instead) |
| `undo:broadcast` | S→C | Unchanged |
| `redo:broadcast` | S→C | Unchanged |
| `undo:state` | S→C | Unchanged |
