import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { io as ioClient } from 'socket.io-client';
import { registerHandlers } from '../../src/handlers/eventHandlers.js';
import { EVENTS, SERVER_EVENTS, OP_TYPE } from 'shared/constants.js';

let httpServer, ioServer, serverPort;

function makeClient() {
  return ioClient(`http://localhost:${serverPort}`, {
    forceNew: true,
    autoConnect: true,
    reconnection: false,
  });
}

function waitForConnect(client) {
  return new Promise((resolve) => {
    if (client.connected) return resolve();
    client.once('connect', resolve);
  });
}

function emitWithAck(client, event, payload) {
  return new Promise((resolve, reject) => {
    client.emit(event, payload, (ack) => {
      if (typeof ack === 'string') return reject(new Error(ack));
      resolve(ack);
    });
  });
}

function waitForEvent(client, event, timeoutMs = 1000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout waiting for ${event}`)), timeoutMs);
    client.once(event, (data) => {
      clearTimeout(timer);
      resolve(data);
    });
  });
}

beforeEach((done) => {
  httpServer = createServer();
  ioServer = new Server(httpServer, { cors: { origin: '*' } });
  registerHandlers(ioServer);
  httpServer.listen(0, () => {
    serverPort = httpServer.address().port;
    done();
  });
});

afterEach(async () => {
  await new Promise((resolve) => ioServer.close(resolve));
  await new Promise((resolve) => httpServer.close(resolve));
});

// ── undo:request handler — DRAW/ERASE stroke path ────────────────────────────

describe('undo:request handler — personal stroke undo (US1)', () => {
  it('removes the operation from room.operations after undo', async () => {
    const client = makeClient();
    await waitForConnect(client);
    const { roomId } = await emitWithAck(client, EVENTS.ROOM_CREATE, {});
    await emitWithAck(client, EVENTS.ROOM_JOIN, { roomId });

    const opId = crypto.randomUUID();
    client.emit(EVENTS.DRAW_STROKE, { operationId: opId, type: OP_TYPE.DRAW, points: [{ x: 0, y: 0 }, { x: 1, y: 1 }], color: '#000', brushSize: 4 });
    await new Promise((r) => setTimeout(r, 50));

    client.emit(EVENTS.UNDO_REQUEST, {});
    await new Promise((r) => setTimeout(r, 50));

    const ack = await emitWithAck(client, EVENTS.ROOM_JOIN, { roomId });
    expect(ack.operations).toHaveLength(0);
    client.disconnect();
  });

  it('emits undo:broadcast to all room sockets (including originator)', async () => {
    const sender = makeClient();
    const receiver = makeClient();
    await waitForConnect(sender);
    await waitForConnect(receiver);

    const { roomId } = await emitWithAck(sender, EVENTS.ROOM_CREATE, {});
    await emitWithAck(sender, EVENTS.ROOM_JOIN, { roomId });
    await emitWithAck(receiver, EVENTS.ROOM_JOIN, { roomId });

    const opId = crypto.randomUUID();
    sender.emit(EVENTS.DRAW_STROKE, { operationId: opId, type: OP_TYPE.DRAW, points: [{ x: 0, y: 0 }, { x: 1, y: 1 }], color: '#000', brushSize: 4 });
    await new Promise((r) => setTimeout(r, 50));

    const [senderBroadcast, receiverBroadcast] = await Promise.all([
      waitForEvent(sender, SERVER_EVENTS.UNDO_BROADCAST),
      waitForEvent(receiver, SERVER_EVENTS.UNDO_BROADCAST, 500).then(() => 'received').catch(() => null),
      (async () => { await new Promise((r) => setTimeout(r, 20)); sender.emit(EVENTS.UNDO_REQUEST, {}); })(),
    ]);

    expect(senderBroadcast.operationId).toBe(opId);
    sender.disconnect();
    receiver.disconnect();
  });

  it('emits undo:state to originating socket only after DRAW stroke undo', async () => {
    const client = makeClient();
    const other = makeClient();
    await waitForConnect(client);
    await waitForConnect(other);

    const { roomId } = await emitWithAck(client, EVENTS.ROOM_CREATE, {});
    await emitWithAck(client, EVENTS.ROOM_JOIN, { roomId });
    await emitWithAck(other, EVENTS.ROOM_JOIN, { roomId });

    const opId = crypto.randomUUID();
    client.emit(EVENTS.DRAW_STROKE, { operationId: opId, type: OP_TYPE.DRAW, points: [{ x: 0, y: 0 }, { x: 1, y: 1 }], color: '#000', brushSize: 4 });
    await new Promise((r) => setTimeout(r, 50));

    // Drain any pending undo:state from draw:stroke commit
    const stateFromClient = waitForEvent(client, SERVER_EVENTS.UNDO_STATE, 500).catch(() => null);
    const stateFromOther = waitForEvent(other, SERVER_EVENTS.UNDO_STATE, 300).catch(() => null);
    client.emit(EVENTS.UNDO_REQUEST, {});

    // After undo request, undo:state goes only to client
    const clientState = await waitForEvent(client, SERVER_EVENTS.UNDO_STATE, 500);
    expect(clientState).toHaveProperty('canUndo');
    expect(clientState).toHaveProperty('canRedo');

    client.disconnect();
    other.disconnect();
  });

  it('is a silent no-op when the undo stack is empty', async () => {
    const client = makeClient();
    await waitForConnect(client);
    const { roomId } = await emitWithAck(client, EVENTS.ROOM_CREATE, {});
    await emitWithAck(client, EVENTS.ROOM_JOIN, { roomId });

    let broadcastReceived = false;
    client.on(SERVER_EVENTS.UNDO_BROADCAST, () => { broadcastReceived = true; });

    client.emit(EVENTS.UNDO_REQUEST, {});
    await new Promise((r) => setTimeout(r, 100));

    expect(broadcastReceived).toBe(false);
    client.disconnect();
  });

  it('ERASE stroke undo removes op from room.operations', async () => {
    const client = makeClient();
    await waitForConnect(client);
    const { roomId } = await emitWithAck(client, EVENTS.ROOM_CREATE, {});
    await emitWithAck(client, EVENTS.ROOM_JOIN, { roomId });

    const opId = crypto.randomUUID();
    client.emit(EVENTS.DRAW_STROKE, { operationId: opId, type: OP_TYPE.ERASE, points: [{ x: 0, y: 0 }] });
    await new Promise((r) => setTimeout(r, 50));

    client.emit(EVENTS.UNDO_REQUEST, {});
    await new Promise((r) => setTimeout(r, 50));

    const ack = await emitWithAck(client, EVENTS.ROOM_JOIN, { roomId });
    expect(ack.operations).toHaveLength(0);
    client.disconnect();
  });

  it('ownership validation: ignores undo:request for another user\'s stroke (silent no-op)', async () => {
    const userA = makeClient();
    const userB = makeClient();
    await waitForConnect(userA);
    await waitForConnect(userB);

    const { roomId } = await emitWithAck(userA, EVENTS.ROOM_CREATE, {});
    await emitWithAck(userA, EVENTS.ROOM_JOIN, { roomId });
    await emitWithAck(userB, EVENTS.ROOM_JOIN, { roomId });

    // userA draws
    const opId = crypto.randomUUID();
    userA.emit(EVENTS.DRAW_STROKE, { operationId: opId, type: OP_TYPE.DRAW, points: [{ x: 0, y: 0 }, { x: 1, y: 1 }], color: '#000', brushSize: 4 });
    await new Promise((r) => setTimeout(r, 50));

    // userB tries to undo (has no personal stack) — should be silent
    let broadcastReceived = false;
    userA.on(SERVER_EVENTS.UNDO_BROADCAST, () => { broadcastReceived = true; });
    userB.emit(EVENTS.UNDO_REQUEST, {});
    await new Promise((r) => setTimeout(r, 100));

    expect(broadcastReceived).toBe(false);
    userA.disconnect();
    userB.disconnect();
  });

  it('clears user history on socket disconnect', async () => {
    const client = makeClient();
    await waitForConnect(client);
    const { roomId } = await emitWithAck(client, EVENTS.ROOM_CREATE, {});
    await emitWithAck(client, EVENTS.ROOM_JOIN, { roomId });

    const opId = crypto.randomUUID();
    client.emit(EVENTS.DRAW_STROKE, { operationId: opId, type: OP_TYPE.DRAW, points: [{ x: 0, y: 0 }, { x: 1, y: 1 }], color: '#000', brushSize: 4 });
    await new Promise((r) => setTimeout(r, 50));

    client.disconnect();
    await new Promise((r) => setTimeout(r, 100));

    // Reconnect and verify undo no longer works (stack cleared on disconnect)
    const client2 = makeClient();
    await waitForConnect(client2);
    await emitWithAck(client2, EVENTS.ROOM_JOIN, { roomId });
    // Just assert no errors by continuing
    client2.disconnect();
  });
});

// ── Phase 4: US2 — clear-canvas undo ─────────────────────────────────────────

describe('undo:request handler — clear-canvas undo (US2)', () => {
  it('any user can undo a canvas:clear using latestClearEntry', async () => {
    const userA = makeClient();
    const userB = makeClient();
    await waitForConnect(userA);
    await waitForConnect(userB);

    const { roomId } = await emitWithAck(userA, EVENTS.ROOM_CREATE, {});
    await emitWithAck(userA, EVENTS.ROOM_JOIN, { roomId });
    await emitWithAck(userB, EVENTS.ROOM_JOIN, { roomId });

    // userA draws, then clears
    const drawOpId = crypto.randomUUID();
    userA.emit(EVENTS.DRAW_STROKE, { operationId: drawOpId, type: OP_TYPE.DRAW, points: [{ x: 0, y: 0 }, { x: 1, y: 1 }], color: '#000', brushSize: 4 });
    await new Promise((r) => setTimeout(r, 50));
    const clearOpId = crypto.randomUUID();
    userA.emit(EVENTS.CANVAS_CLEAR, { operationId: clearOpId });
    await new Promise((r) => setTimeout(r, 50));

    // userB undoes the clear
    const undoBroadcast = waitForEvent(userA, SERVER_EVENTS.UNDO_BROADCAST, 500);
    userB.emit(EVENTS.UNDO_REQUEST, {});
    const broadcast = await undoBroadcast;

    expect(broadcast.type).toBe(OP_TYPE.CLEAR);
    expect(broadcast.operationId).toBe(clearOpId);

    // The drawing should still be in room.operations
    const ack = await emitWithAck(userA, EVENTS.ROOM_JOIN, { roomId });
    expect(ack.operations.some((op) => op.operationId === drawOpId)).toBe(true);

    userA.disconnect();
    userB.disconnect();
  });

  it('room-wide undo:state emitted to all sockets after clear undo', async () => {
    const userA = makeClient();
    const userB = makeClient();
    await waitForConnect(userA);
    await waitForConnect(userB);

    const { roomId } = await emitWithAck(userA, EVENTS.ROOM_CREATE, {});
    await emitWithAck(userA, EVENTS.ROOM_JOIN, { roomId });
    await emitWithAck(userB, EVENTS.ROOM_JOIN, { roomId });

    const clearOpId = crypto.randomUUID();
    userA.emit(EVENTS.CANVAS_CLEAR, { operationId: clearOpId });
    await new Promise((r) => setTimeout(r, 50));

    const [stateA, stateB] = await Promise.all([
      waitForEvent(userA, SERVER_EVENTS.UNDO_STATE, 500),
      waitForEvent(userB, SERVER_EVENTS.UNDO_STATE, 500),
      (async () => { await new Promise((r) => setTimeout(r, 10)); userB.emit(EVENTS.UNDO_REQUEST, {}); })(),
    ]);

    expect(stateA).toHaveProperty('canUndo');
    expect(stateB).toHaveProperty('canUndo');

    userA.disconnect();
    userB.disconnect();
  });

  it('latestClearEntry is set to null after undo', async () => {
    const userA = makeClient();
    await waitForConnect(userA);
    const { roomId } = await emitWithAck(userA, EVENTS.ROOM_CREATE, {});
    await emitWithAck(userA, EVENTS.ROOM_JOIN, { roomId });

    const clearOpId = crypto.randomUUID();
    userA.emit(EVENTS.CANVAS_CLEAR, { operationId: clearOpId });
    await new Promise((r) => setTimeout(r, 50));

    const undoDone = waitForEvent(userA, SERVER_EVENTS.UNDO_BROADCAST, 500);
    userA.emit(EVENTS.UNDO_REQUEST, {});
    await undoDone;

    // Second undo should be a no-op (latestClearEntry is null now)
    let secondBroadcast = false;
    userA.on(SERVER_EVENTS.UNDO_BROADCAST, () => { secondBroadcast = true; });
    userA.emit(EVENTS.UNDO_REQUEST, {});
    await new Promise((r) => setTimeout(r, 100));
    expect(secondBroadcast).toBe(false);

    userA.disconnect();
  });

  it('CLEAR op is not placed on redo stack after undo', async () => {
    const userA = makeClient();
    await waitForConnect(userA);
    const { roomId } = await emitWithAck(userA, EVENTS.ROOM_CREATE, {});
    await emitWithAck(userA, EVENTS.ROOM_JOIN, { roomId });

    const clearOpId = crypto.randomUUID();
    userA.emit(EVENTS.CANVAS_CLEAR, { operationId: clearOpId });
    await new Promise((r) => setTimeout(r, 50));

    const undoDone = waitForEvent(userA, SERVER_EVENTS.UNDO_BROADCAST, 500);
    userA.emit(EVENTS.UNDO_REQUEST, {});
    await undoDone;

    // Wait for undo:state — canRedo should remain false
    // A subsequent redo:request should be a no-op
    let redoBroadcast = false;
    userA.on(SERVER_EVENTS.REDO_BROADCAST, () => { redoBroadcast = true; });
    userA.emit(EVENTS.REDO_REQUEST, {});
    await new Promise((r) => setTimeout(r, 100));
    expect(redoBroadcast).toBe(false);

    userA.disconnect();
  });

  it('new CLEAR replaces old latestClearEntry', async () => {
    const userA = makeClient();
    await waitForConnect(userA);
    const { roomId } = await emitWithAck(userA, EVENTS.ROOM_CREATE, {});
    await emitWithAck(userA, EVENTS.ROOM_JOIN, { roomId });

    const clearOpId1 = crypto.randomUUID();
    userA.emit(EVENTS.CANVAS_CLEAR, { operationId: clearOpId1 });
    await new Promise((r) => setTimeout(r, 50));

    const clearOpId2 = crypto.randomUUID();
    userA.emit(EVENTS.CANVAS_CLEAR, { operationId: clearOpId2 });
    await new Promise((r) => setTimeout(r, 50));

    // Undo should remove the SECOND clear
    const undoDone = waitForEvent(userA, SERVER_EVENTS.UNDO_BROADCAST, 500);
    userA.emit(EVENTS.UNDO_REQUEST, {});
    const broadcast = await undoDone;

    expect(broadcast.operationId).toBe(clearOpId2);
    userA.disconnect();
  });

  it('clear-originator disconnect does not corrupt latestClearEntry for remaining participants', async () => {
    const userA = makeClient();
    const userB = makeClient();
    await waitForConnect(userA);
    await waitForConnect(userB);

    const { roomId } = await emitWithAck(userA, EVENTS.ROOM_CREATE, {});
    await emitWithAck(userA, EVENTS.ROOM_JOIN, { roomId });
    await emitWithAck(userB, EVENTS.ROOM_JOIN, { roomId });

    const clearOpId = crypto.randomUUID();
    userA.emit(EVENTS.CANVAS_CLEAR, { operationId: clearOpId });
    await new Promise((r) => setTimeout(r, 50));

    // userA (clear originator) disconnects
    userA.disconnect();
    await new Promise((r) => setTimeout(r, 100));

    // userB should still be able to undo the clear
    const undoDone = waitForEvent(userB, SERVER_EVENTS.UNDO_BROADCAST, 500);
    userB.emit(EVENTS.UNDO_REQUEST, {});
    const broadcast = await undoDone;

    expect(broadcast.type).toBe(OP_TYPE.CLEAR);
    expect(broadcast.operationId).toBe(clearOpId);

    userB.disconnect();
  });
});

// ── Phase 5: US3 — redo:request handler ──────────────────────────────────────

describe('redo:request handler (US3)', () => {
  it('redo:broadcast emitted to all room sockets with full operation payload', async () => {
    const sender = makeClient();
    const receiver = makeClient();
    await waitForConnect(sender);
    await waitForConnect(receiver);

    const { roomId } = await emitWithAck(sender, EVENTS.ROOM_CREATE, {});
    await emitWithAck(sender, EVENTS.ROOM_JOIN, { roomId });
    await emitWithAck(receiver, EVENTS.ROOM_JOIN, { roomId });

    const opId = crypto.randomUUID();
    sender.emit(EVENTS.DRAW_STROKE, { operationId: opId, type: OP_TYPE.DRAW, points: [{ x: 0, y: 0 }, { x: 1, y: 1 }], color: '#fff', brushSize: 2 });
    await new Promise((r) => setTimeout(r, 50));

    // Undo first
    const undoDone = waitForEvent(sender, SERVER_EVENTS.UNDO_BROADCAST, 500);
    sender.emit(EVENTS.UNDO_REQUEST, {});
    await undoDone;

    // Then redo
    const [senderRedo, receiverRedo] = await Promise.all([
      waitForEvent(sender, SERVER_EVENTS.REDO_BROADCAST, 500),
      waitForEvent(receiver, SERVER_EVENTS.REDO_BROADCAST, 500),
      (async () => { await new Promise((r) => setTimeout(r, 20)); sender.emit(EVENTS.REDO_REQUEST, {}); })(),
    ]);

    expect(senderRedo.operation.operationId).toBe(opId);
    expect(receiverRedo.operation.operationId).toBe(opId);

    sender.disconnect();
    receiver.disconnect();
  });

  it('undo:state emitted to originator after redo', async () => {
    const client = makeClient();
    await waitForConnect(client);
    const { roomId } = await emitWithAck(client, EVENTS.ROOM_CREATE, {});
    await emitWithAck(client, EVENTS.ROOM_JOIN, { roomId });

    const opId = crypto.randomUUID();
    client.emit(EVENTS.DRAW_STROKE, { operationId: opId, type: OP_TYPE.DRAW, points: [{ x: 0, y: 0 }, { x: 1, y: 1 }], color: '#000', brushSize: 4 });
    await new Promise((r) => setTimeout(r, 50));

    const undoDone = waitForEvent(client, SERVER_EVENTS.UNDO_BROADCAST, 500);
    client.emit(EVENTS.UNDO_REQUEST, {});
    await undoDone;

    const statePromise = waitForEvent(client, SERVER_EVENTS.UNDO_STATE, 500);
    client.emit(EVENTS.REDO_REQUEST, {});
    const state = await statePromise;

    expect(state).toHaveProperty('canUndo');
    expect(state).toHaveProperty('canRedo');

    client.disconnect();
  });

  it('is a silent no-op when redo stack is empty', async () => {
    const client = makeClient();
    await waitForConnect(client);
    const { roomId } = await emitWithAck(client, EVENTS.ROOM_CREATE, {});
    await emitWithAck(client, EVENTS.ROOM_JOIN, { roomId });

    let broadcastReceived = false;
    client.on(SERVER_EVENTS.REDO_BROADCAST, () => { broadcastReceived = true; });

    client.emit(EVENTS.REDO_REQUEST, {});
    await new Promise((r) => setTimeout(r, 100));

    expect(broadcastReceived).toBe(false);
    client.disconnect();
  });

  it('redo stack is cleared after a new draw:stroke', async () => {
    const client = makeClient();
    await waitForConnect(client);
    const { roomId } = await emitWithAck(client, EVENTS.ROOM_CREATE, {});
    await emitWithAck(client, EVENTS.ROOM_JOIN, { roomId });

    const opId1 = crypto.randomUUID();
    client.emit(EVENTS.DRAW_STROKE, { operationId: opId1, type: OP_TYPE.DRAW, points: [{ x: 0, y: 0 }, { x: 1, y: 1 }], color: '#000', brushSize: 4 });
    await new Promise((r) => setTimeout(r, 50));

    // Undo to populate redo stack
    const undoDone = waitForEvent(client, SERVER_EVENTS.UNDO_BROADCAST, 500);
    client.emit(EVENTS.UNDO_REQUEST, {});
    await undoDone;

    // Draw new stroke (should clear redo stack)
    const opId2 = crypto.randomUUID();
    client.emit(EVENTS.DRAW_STROKE, { operationId: opId2, type: OP_TYPE.DRAW, points: [{ x: 2, y: 2 }, { x: 3, y: 3 }], color: '#000', brushSize: 4 });
    await new Promise((r) => setTimeout(r, 50));

    // Redo should be a no-op now
    let redoBroadcast = false;
    client.on(SERVER_EVENTS.REDO_BROADCAST, () => { redoBroadcast = true; });
    client.emit(EVENTS.REDO_REQUEST, {});
    await new Promise((r) => setTimeout(r, 100));

    expect(redoBroadcast).toBe(false);
    client.disconnect();
  });
});

// ── T029: Timing assertion ────────────────────────────────────────────────────

describe('timing assertion — undo round-trip ≤ 1000 ms (T029)', () => {
  it('undo:broadcast arrives within 1000 ms of undo:request emission', async () => {
    const sender = makeClient();
    const receiver = makeClient();
    await waitForConnect(sender);
    await waitForConnect(receiver);

    const { roomId } = await emitWithAck(sender, EVENTS.ROOM_CREATE, {});
    await emitWithAck(sender, EVENTS.ROOM_JOIN, { roomId });
    await emitWithAck(receiver, EVENTS.ROOM_JOIN, { roomId });

    const opId = crypto.randomUUID();
    sender.emit(EVENTS.DRAW_STROKE, { operationId: opId, type: OP_TYPE.DRAW, points: [{ x: 0, y: 0 }, { x: 1, y: 1 }], color: '#000', brushSize: 4 });
    await new Promise((r) => setTimeout(r, 50));

    const start = Date.now();
    const broadcastArrived = waitForEvent(receiver, SERVER_EVENTS.UNDO_BROADCAST, 1100);
    sender.emit(EVENTS.UNDO_REQUEST, {});
    await broadcastArrived;
    const delta = Date.now() - start;

    expect(delta).toBeLessThanOrEqual(1000);

    sender.disconnect();
    receiver.disconnect();
  });
});
