import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { io as ioClient } from 'socket.io-client';
import { registerHandlers } from '../../src/handlers/eventHandlers.js';
import { EVENTS } from 'shared/constants.js';

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

describe('room:create handler', () => {
  it('acks {ok:true, roomId, userId}', async () => {
    const client = makeClient();
    await waitForConnect(client);
    const ack = await emitWithAck(client, EVENTS.ROOM_CREATE, {});
    expect(ack.ok).toBe(true);
    expect(ack.roomId).toMatch(/^[A-Z0-9]{6}$/);
    expect(ack.userId).toBeTruthy();
    client.disconnect();
  });
});

describe('room:join handler', () => {
  it('acks {ok:true, operations:[]} for a freshly created room', async () => {
    const creator = makeClient();
    await waitForConnect(creator);
    const { roomId } = await emitWithAck(creator, EVENTS.ROOM_CREATE, {});

    const joiner = makeClient();
    await waitForConnect(joiner);
    const ack = await emitWithAck(joiner, EVENTS.ROOM_JOIN, { roomId });
    expect(ack.ok).toBe(true);
    expect(Array.isArray(ack.operations)).toBe(true);
    expect(ack.operations).toHaveLength(0);

    joiner.disconnect();
    creator.disconnect();
  });

  it('acks {ok:false, error:"ROOM_NOT_FOUND"} for an unknown room', async () => {
    const client = makeClient();
    await waitForConnect(client);
    const ack = await emitWithAck(client, EVENTS.ROOM_JOIN, { roomId: 'XXXXXX' });
    expect(ack.ok).toBe(false);
    expect(ack.error).toBe('ROOM_NOT_FOUND');
    client.disconnect();
  });

  it('returns only ops with sequenceNumber > lastSequence when delta requested', async () => {
    const client1 = makeClient();
    await waitForConnect(client1);
    const { roomId } = await emitWithAck(client1, EVENTS.ROOM_CREATE, {});
    await emitWithAck(client1, EVENTS.ROOM_JOIN, { roomId });

    // Emit two draw strokes (fire-and-forget, no ack)
    client1.emit(EVENTS.DRAW_STROKE, { operationId: crypto.randomUUID(), type: 'DRAW', points: [{ x: 0, y: 0 }, { x: 1, y: 1 }] });
    client1.emit(EVENTS.DRAW_STROKE, { operationId: crypto.randomUUID(), type: 'DRAW', points: [{ x: 2, y: 2 }, { x: 3, y: 3 }] });

    // Give server time to process both strokes
    await new Promise((r) => setTimeout(r, 100));

    const client3 = makeClient();
    await waitForConnect(client3);
    const ack = await emitWithAck(client3, EVENTS.ROOM_JOIN, { roomId, lastSequence: 1 });
    expect(ack.ok).toBe(true);
    const seqNums = ack.operations.map((op) => op.sequenceNumber);
    expect(seqNums.every((s) => s > 1)).toBe(true);

    client1.disconnect();
    client3.disconnect();
  });
});

describe('room:leave handler', () => {
  function waitForEvent(client, event) {
    return new Promise((resolve) => client.once(event, resolve));
  }

  it('removes the leaving user from the participants list broadcast to remaining members', async () => {
    const creator = makeClient();
    await waitForConnect(creator);
    const { roomId } = await emitWithAck(creator, EVENTS.ROOM_CREATE, { displayName: 'Alice' });

    const joiner = makeClient();
    await waitForConnect(joiner);
    await emitWithAck(joiner, EVENTS.ROOM_JOIN, { roomId, displayName: 'Bob' });

    // Wait for the join PARTICIPANTS_UPDATED that creator will receive, then reset
    await new Promise((r) => setTimeout(r, 50));

    // Creator listens for the PARTICIPANTS_UPDATED triggered by Bob leaving
    const updatePromise = waitForEvent(creator, 'participants:updated');

    joiner.emit(EVENTS.ROOM_LEAVE, { roomId });

    const update = await updatePromise;
    expect(update.participants).toHaveLength(1);
    expect(update.participants[0].displayName).toBe('Alice');

    creator.disconnect();
    joiner.disconnect();
  });

  it('does not broadcast PARTICIPANTS_UPDATED to the leaving user', async () => {
    const creator = makeClient();
    await waitForConnect(creator);
    const { roomId } = await emitWithAck(creator, EVENTS.ROOM_CREATE, { displayName: 'Alice' });

    const joiner = makeClient();
    await waitForConnect(joiner);
    await emitWithAck(joiner, EVENTS.ROOM_JOIN, { roomId, displayName: 'Bob' });
    await new Promise((r) => setTimeout(r, 50));

    let leaverReceivedUpdate = false;
    joiner.on('participants:updated', () => { leaverReceivedUpdate = true; });

    joiner.emit(EVENTS.ROOM_LEAVE, { roomId });

    // Give time for any spurious event to arrive
    await new Promise((r) => setTimeout(r, 100));
    expect(leaverReceivedUpdate).toBe(false);

    creator.disconnect();
    joiner.disconnect();
  });
});
