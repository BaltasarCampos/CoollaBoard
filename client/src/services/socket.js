import { io } from 'socket.io-client';
import { EVENTS, CONNECTION_STATUS, ERROR_CODES } from 'shared/constants.js';

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

socket.on('connect',           () => emitStatus(CONNECTION_STATUS.CONNECTED));
socket.on('disconnect',        () => emitStatus(CONNECTION_STATUS.DISCONNECTED));
socket.on('reconnect_attempt', () => emitStatus(CONNECTION_STATUS.RECONNECTING));
socket.on('reconnect',         () => emitStatus(CONNECTION_STATUS.CONNECTED));

export function getSocket() {
  return socket;
}

export function onConnectionStatus(cb) {
  statusCallbacks.add(cb);
  // Immediately call with current status so components mounting after connect see the right state
  cb(socket.connected ? CONNECTION_STATUS.CONNECTED : CONNECTION_STATUS.DISCONNECTED);
}

export function offConnectionStatus(cb) {
  statusCallbacks.delete(cb);
}

export function createRoom() {
  return new Promise((resolve, reject) => {
    socket.emit(EVENTS.ROOM_CREATE, {}, (ack) => {
      if (ack?.ok) resolve({ roomId: ack.roomId, userId: ack.userId });
      else reject(new Error(ack?.error || ERROR_CODES.SERVER_ERROR));
    });
  });
}

export function joinRoom(roomId, lastSequence) {
  return new Promise((resolve, reject) => {
    const payload = lastSequence != null ? { roomId, lastSequence } : { roomId };
    socket.emit(EVENTS.ROOM_JOIN, payload, (ack) => {
      if (ack?.ok) resolve({ operations: ack.operations, userId: ack.userId });
      else reject(new Error(ack?.error || ERROR_CODES.SERVER_ERROR));
    });
  });
}

export function emitStroke(operationId, type, points, color, brushSize) {
  socket.emit(EVENTS.DRAW_STROKE, { operationId, type, points, color, brushSize });
}

export function emitClear(operationId) {
  socket.emit(EVENTS.CANVAS_CLEAR, { operationId });
}

export function emitStrokePreview(payload) {
  socket.emit(EVENTS.STROKE_PREVIEW, payload);
}

export function emitStrokeCancel(payload) {
  socket.emit(EVENTS.STROKE_CANCEL, payload);
}
