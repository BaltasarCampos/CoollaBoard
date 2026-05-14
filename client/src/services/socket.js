import { io } from 'socket.io-client';
import { EVENTS, SERVER_EVENTS } from 'shared/constants.js';

const socket = io('http://localhost:3001', {
  autoConnect: true,
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 10000,
});

// Expose for E2E tests
if (typeof window !== 'undefined') window.__socket = socket;

const statusCallbacks = new Set();

function emitStatus(status) {
  for (const cb of statusCallbacks) cb(status);
}

socket.on('connect',           () => emitStatus('Connected'));
socket.on('disconnect',        () => emitStatus('Disconnected'));
socket.on('reconnect_attempt', () => emitStatus('Reconnecting'));
socket.on('reconnect',         () => emitStatus('Connected'));

export function getSocket() {
  return socket;
}

export function onConnectionStatus(cb) {
  statusCallbacks.add(cb);
}

export function offConnectionStatus(cb) {
  statusCallbacks.delete(cb);
}

export function createRoom() {
  return new Promise((resolve, reject) => {
    socket.emit(EVENTS.ROOM_CREATE, {}, (ack) => {
      if (ack?.ok) resolve({ roomId: ack.roomId, userId: ack.userId });
      else reject(new Error(ack?.error || 'SERVER_ERROR'));
    });
  });
}

export function joinRoom(roomId, lastSequence) {
  return new Promise((resolve, reject) => {
    const payload = lastSequence != null ? { roomId, lastSequence } : { roomId };
    socket.emit(EVENTS.ROOM_JOIN, payload, (ack) => {
      if (ack?.ok) resolve({ operations: ack.operations, userId: ack.userId });
      else reject(new Error(ack?.error || 'SERVER_ERROR'));
    });
  });
}

export function emitStroke(operationId, type, points) {
  socket.emit(EVENTS.DRAW_STROKE, { operationId, type, points });
}

export function emitClear(operationId) {
  socket.emit(EVENTS.CANVAS_CLEAR, { operationId });
}
