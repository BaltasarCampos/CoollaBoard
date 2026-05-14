import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { io as ioClient } from 'socket.io-client';
import { registerHandlers } from '../../src/handlers/eventHandlers.js';
import { EVENTS, SERVER_EVENTS, OP_TYPE } from 'shared/constants.js';

let httpServer, ioServer, serverPort;

function makeClient() {
  return ioClient(`http://localhost:${serverPort}`, { forceNew: true, autoConnect: true, reconnection: false });
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
  httpServer.listen(0, () => { serverPort = httpServer.address().port; done(); });
});

afterEach(async () => {
  await new Promise((resolve) => ioServer.close(resolve));
  await new Promise((resolve) => httpServer.close(resolve));
});

describe('canvas:clear handler', () => {
  it('appends a CLEAR operation with a sequenceNumber', async () => {
    const client = makeClient();
    await waitForConnect(client);
    const { roomId } = await emitWithAck(client, EVENTS.ROOM_CREATE, {});
    await emitWithAck(client, EVENTS.ROOM_JOIN, { roomId });

    client.emit(EVENTS.CANVAS_CLEAR, { operationId: crypto.randomUUID() });
    await new Promise((r) => setTimeout(r, 100));

    const ack = await emitWithAck(client, EVENTS.ROOM_JOIN, { roomId });
    expect(ack.operations).toHaveLength(1);
    expect(ack.operations[0].type).toBe(OP_TYPE.CLEAR);
    expect(ack.operations[0].sequenceNumber).toBe(1);

    client.disconnect();
  });

  it('broadcasts canvas:cleared to ALL sockets including sender', async () => {
    const sender   = makeClient();
    const observer = makeClient();
    await waitForConnect(sender);
    await waitForConnect(observer);

    const { roomId } = await emitWithAck(sender, EVENTS.ROOM_CREATE, {});
    await emitWithAck(sender, EVENTS.ROOM_JOIN, { roomId });
    await emitWithAck(observer, EVENTS.ROOM_JOIN, { roomId });

    const senderCleared   = new Promise((r) => sender.once(SERVER_EVENTS.CANVAS_CLEARED, r));
    const observerCleared = new Promise((r) => observer.once(SERVER_EVENTS.CANVAS_CLEARED, r));

    sender.emit(EVENTS.CANVAS_CLEAR, { operationId: crypto.randomUUID() });

    const [sc, oc] = await Promise.all([senderCleared, observerCleared]);
    expect(sc.type).toBe(OP_TYPE.CLEAR);
    expect(oc.type).toBe(OP_TYPE.CLEAR);

    sender.disconnect();
    observer.disconnect();
  });

  it('silently discards duplicate operationId for canvas:clear', async () => {
    const client = makeClient();
    await waitForConnect(client);
    const { roomId } = await emitWithAck(client, EVENTS.ROOM_CREATE, {});
    await emitWithAck(client, EVENTS.ROOM_JOIN, { roomId });

    const opId = crypto.randomUUID();
    client.emit(EVENTS.CANVAS_CLEAR, { operationId: opId });
    client.emit(EVENTS.CANVAS_CLEAR, { operationId: opId });
    await new Promise((r) => setTimeout(r, 100));

    const ack = await emitWithAck(client, EVENTS.ROOM_JOIN, { roomId });
    expect(ack.operations).toHaveLength(1);

    client.disconnect();
  });
});
