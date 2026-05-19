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

describe('draw:stroke handler', () => {
  it('appends a DRAW operation with server-assigned sequenceNumber', async () => {
    const client = makeClient();
    await waitForConnect(client);
    const { roomId } = await emitWithAck(client, EVENTS.ROOM_CREATE, {});
    await emitWithAck(client, EVENTS.ROOM_JOIN, { roomId });

    client.emit(EVENTS.DRAW_STROKE, {
      operationId: crypto.randomUUID(),
      type: OP_TYPE.DRAW,
      points: [{ x: 0, y: 0 }, { x: 10, y: 10 }],
    });

    await new Promise((r) => setTimeout(r, 100));

    const ack = await emitWithAck(client, EVENTS.ROOM_JOIN, { roomId });
    expect(ack.operations).toHaveLength(1);
    expect(ack.operations[0].sequenceNumber).toBe(1);
    expect(ack.operations[0].type).toBe(OP_TYPE.DRAW);

    client.disconnect();
  });

  it('silently discards duplicate operationId', async () => {
    const client = makeClient();
    await waitForConnect(client);
    const { roomId } = await emitWithAck(client, EVENTS.ROOM_CREATE, {});
    await emitWithAck(client, EVENTS.ROOM_JOIN, { roomId });

    const opId = crypto.randomUUID();
    const stroke = { operationId: opId, type: OP_TYPE.DRAW, points: [{ x: 0, y: 0 }, { x: 1, y: 1 }] };
    client.emit(EVENTS.DRAW_STROKE, stroke);
    client.emit(EVENTS.DRAW_STROKE, stroke);

    await new Promise((r) => setTimeout(r, 100));

    const ack = await emitWithAck(client, EVENTS.ROOM_JOIN, { roomId });
    expect(ack.operations).toHaveLength(1);

    client.disconnect();
  });

  it('broadcasts draw:broadcast to other clients but not sender', async () => {
    const sender = makeClient();
    const receiver = makeClient();
    await waitForConnect(sender);
    await waitForConnect(receiver);

    const { roomId } = await emitWithAck(sender, EVENTS.ROOM_CREATE, {});
    await emitWithAck(sender, EVENTS.ROOM_JOIN, { roomId });
    await emitWithAck(receiver, EVENTS.ROOM_JOIN, { roomId });

    const broadcastReceived = new Promise((resolve) => {
      receiver.once(SERVER_EVENTS.DRAW_BROADCAST, resolve);
    });

    const senderBroadcast = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => resolve(null), 200); // no broadcast to sender expected
      sender.once(SERVER_EVENTS.DRAW_BROADCAST, (data) => {
        clearTimeout(timeout);
        reject(new Error('Sender should not receive draw:broadcast'));
      });
    });

    sender.emit(EVENTS.DRAW_STROKE, {
      operationId: crypto.randomUUID(),
      type: OP_TYPE.DRAW,
      points: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
    });

    const broadcast = await broadcastReceived;
    expect(broadcast.type).toBe(OP_TYPE.DRAW);
    expect(broadcast.sequenceNumber).toBe(1);

    await senderBroadcast; // should resolve with null (timeout), not reject

    sender.disconnect();
    receiver.disconnect();
  });

  it('ERASE type is also accepted and processed', async () => {
    const client = makeClient();
    await waitForConnect(client);
    const { roomId } = await emitWithAck(client, EVENTS.ROOM_CREATE, {});
    await emitWithAck(client, EVENTS.ROOM_JOIN, { roomId });

    client.emit(EVENTS.DRAW_STROKE, {
      operationId: crypto.randomUUID(),
      type: OP_TYPE.ERASE,
      points: [{ x: 50, y: 50 }],
    });

    await new Promise((r) => setTimeout(r, 100));
    const ack = await emitWithAck(client, EVENTS.ROOM_JOIN, { roomId });
    expect(ack.operations[0].type).toBe(OP_TYPE.ERASE);

    client.disconnect();
  });

  it('stores color and brushSize in room operations when provided', async () => {
    const client = makeClient();
    await waitForConnect(client);
    const { roomId } = await emitWithAck(client, EVENTS.ROOM_CREATE, {});
    await emitWithAck(client, EVENTS.ROOM_JOIN, { roomId });

    client.emit(EVENTS.DRAW_STROKE, {
      operationId: crypto.randomUUID(),
      type: OP_TYPE.DRAW,
      points: [{ x: 0, y: 0 }, { x: 10, y: 10 }],
      color: '#3b82f6',
      brushSize: 8,
    });

    await new Promise((r) => setTimeout(r, 100));

    const ack = await emitWithAck(client, EVENTS.ROOM_JOIN, { roomId });
    expect(ack.operations[0].color).toBe('#3b82f6');
    expect(ack.operations[0].brushSize).toBe(8);

    client.disconnect();
  });

  it('draw:broadcast includes color and brushSize when provided', async () => {
    const sender = makeClient();
    const receiver = makeClient();
    await waitForConnect(sender);
    await waitForConnect(receiver);

    const { roomId } = await emitWithAck(sender, EVENTS.ROOM_CREATE, {});
    await emitWithAck(sender, EVENTS.ROOM_JOIN, { roomId });
    await emitWithAck(receiver, EVENTS.ROOM_JOIN, { roomId });

    const broadcastReceived = new Promise((resolve) => {
      receiver.once(SERVER_EVENTS.DRAW_BROADCAST, resolve);
    });

    sender.emit(EVENTS.DRAW_STROKE, {
      operationId: crypto.randomUUID(),
      type: OP_TYPE.DRAW,
      points: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
      color: '#22c55e',
      brushSize: 2,
    });

    const broadcast = await broadcastReceived;
    expect(broadcast.color).toBe('#22c55e');
    expect(broadcast.brushSize).toBe(2);

    sender.disconnect();
    receiver.disconnect();
  });

  it('stores stroke without color or brushSize (undefined fields — backward compatibility)', async () => {
    const client = makeClient();
    await waitForConnect(client);
    const { roomId } = await emitWithAck(client, EVENTS.ROOM_CREATE, {});
    await emitWithAck(client, EVENTS.ROOM_JOIN, { roomId });

    client.emit(EVENTS.DRAW_STROKE, {
      operationId: crypto.randomUUID(),
      type: OP_TYPE.DRAW,
      points: [{ x: 0, y: 0 }, { x: 10, y: 10 }],
    });

    await new Promise((r) => setTimeout(r, 100));

    const ack = await emitWithAck(client, EVENTS.ROOM_JOIN, { roomId });
    expect(ack.operations[0].color).toBeUndefined();
    expect(ack.operations[0].brushSize).toBeUndefined();

    client.disconnect();
  });
});

// ── stroke:preview handler (US2) ─────────────────────────────────────────────

describe('stroke:preview handler (US2)', () => {
  it('relays STROKE_PREVIEW_BROADCAST payload to all other sockets in the room', async () => {
    const sender = makeClient();
    const receiver = makeClient();
    await waitForConnect(sender);
    await waitForConnect(receiver);

    const { roomId, userId } = await emitWithAck(sender, EVENTS.ROOM_CREATE, {});
    await emitWithAck(sender, EVENTS.ROOM_JOIN, { roomId });
    await emitWithAck(receiver, EVENTS.ROOM_JOIN, { roomId });

    const broadcastReceived = new Promise((resolve) => {
      receiver.once(SERVER_EVENTS.STROKE_PREVIEW_BROADCAST, resolve);
    });

    const operationId = crypto.randomUUID();
    sender.emit(EVENTS.STROKE_PREVIEW, {
      operationId,
      userId,
      type: OP_TYPE.DRAW,
      points: [{ x: 0, y: 0 }, { x: 10, y: 10 }],
      color: '#3b82f6',
      brushSize: 4,
    });

    const payload = await broadcastReceived;
    expect(payload.operationId).toBe(operationId);
    expect(payload.type).toBe(OP_TYPE.DRAW);

    sender.disconnect();
    receiver.disconnect();
  });

  it('drops stroke:preview and emits warning when userId does not match session', async () => {
    const sender = makeClient();
    const receiver = makeClient();
    await waitForConnect(sender);
    await waitForConnect(receiver);

    const { roomId } = await emitWithAck(sender, EVENTS.ROOM_CREATE, {});
    await emitWithAck(sender, EVENTS.ROOM_JOIN, { roomId });
    await emitWithAck(receiver, EVENTS.ROOM_JOIN, { roomId });

    const broadcastReceived = new Promise((resolve) => {
      const timeout = setTimeout(() => resolve(null), 200);
      receiver.once(SERVER_EVENTS.STROKE_PREVIEW_BROADCAST, (data) => {
        clearTimeout(timeout);
        resolve(data);
      });
    });

    sender.emit(EVENTS.STROKE_PREVIEW, {
      operationId: crypto.randomUUID(),
      userId: 'wrong-user-id',
      type: OP_TYPE.DRAW,
      points: [{ x: 0, y: 0 }],
    });

    const result = await broadcastReceived;
    expect(result).toBeNull(); // dropped, no broadcast

    sender.disconnect();
    receiver.disconnect();
  });

  it('drops stroke:preview when operationId is missing', async () => {
    const sender = makeClient();
    const receiver = makeClient();
    await waitForConnect(sender);
    await waitForConnect(receiver);

    const { roomId, userId } = await emitWithAck(sender, EVENTS.ROOM_CREATE, {});
    await emitWithAck(sender, EVENTS.ROOM_JOIN, { roomId });
    await emitWithAck(receiver, EVENTS.ROOM_JOIN, { roomId });

    const broadcastReceived = new Promise((resolve) => {
      const timeout = setTimeout(() => resolve(null), 200);
      receiver.once(SERVER_EVENTS.STROKE_PREVIEW_BROADCAST, (data) => {
        clearTimeout(timeout);
        resolve(data);
      });
    });

    sender.emit(EVENTS.STROKE_PREVIEW, {
      userId,
      type: OP_TYPE.DRAW,
      points: [{ x: 0, y: 0 }],
    });

    expect(await broadcastReceived).toBeNull();

    sender.disconnect();
    receiver.disconnect();
  });

  it('drops stroke:preview when points is not an array', async () => {
    const sender = makeClient();
    const receiver = makeClient();
    await waitForConnect(sender);
    await waitForConnect(receiver);

    const { roomId, userId } = await emitWithAck(sender, EVENTS.ROOM_CREATE, {});
    await emitWithAck(sender, EVENTS.ROOM_JOIN, { roomId });
    await emitWithAck(receiver, EVENTS.ROOM_JOIN, { roomId });

    const broadcastReceived = new Promise((resolve) => {
      const timeout = setTimeout(() => resolve(null), 200);
      receiver.once(SERVER_EVENTS.STROKE_PREVIEW_BROADCAST, (data) => {
        clearTimeout(timeout);
        resolve(data);
      });
    });

    sender.emit(EVENTS.STROKE_PREVIEW, {
      operationId: crypto.randomUUID(),
      userId,
      type: OP_TYPE.DRAW,
      points: 'not-an-array',
    });

    expect(await broadcastReceived).toBeNull();

    sender.disconnect();
    receiver.disconnect();
  });
});

// ── stroke:cancel handler (US2) ──────────────────────────────────────────────

describe('stroke:cancel handler (US2)', () => {
  it('relays STROKE_CANCEL_BROADCAST { operationId, userId } to room', async () => {
    const sender = makeClient();
    const receiver = makeClient();
    await waitForConnect(sender);
    await waitForConnect(receiver);

    const { roomId, userId } = await emitWithAck(sender, EVENTS.ROOM_CREATE, {});
    await emitWithAck(sender, EVENTS.ROOM_JOIN, { roomId });
    await emitWithAck(receiver, EVENTS.ROOM_JOIN, { roomId });

    const cancelReceived = new Promise((resolve) => {
      receiver.once(SERVER_EVENTS.STROKE_CANCEL_BROADCAST, resolve);
    });

    const operationId = crypto.randomUUID();
    sender.emit(EVENTS.STROKE_CANCEL, { operationId, userId });

    const payload = await cancelReceived;
    expect(payload.operationId).toBe(operationId);
    expect(payload.userId).toBe(userId);

    sender.disconnect();
    receiver.disconnect();
  });
});

// ── disconnect → user:left (US2) ─────────────────────────────────────────────

describe('disconnect handler — user:left (US2)', () => {
  it('emits USER_LEFT { userId } to the room on socket disconnect', async () => {
    const leavingClient = makeClient();
    const stayingClient = makeClient();
    await waitForConnect(leavingClient);
    await waitForConnect(stayingClient);

    const { roomId, userId: leavingUserId } = await emitWithAck(leavingClient, EVENTS.ROOM_CREATE, {});
    await emitWithAck(leavingClient, EVENTS.ROOM_JOIN, { roomId });
    await emitWithAck(stayingClient, EVENTS.ROOM_JOIN, { roomId });

    const userLeftReceived = new Promise((resolve) => {
      stayingClient.once(SERVER_EVENTS.USER_LEFT, resolve);
    });

    leavingClient.disconnect();

    const payload = await userLeftReceived;
    expect(payload.userId).toBe(leavingUserId);

    stayingClient.disconnect();
  });
});

