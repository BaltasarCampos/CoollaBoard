import { EVENTS, SERVER_EVENTS, OP_TYPE, ERROR_CODES } from 'shared/constants.js';
import {
  createRoom,
  getRoom,
  addUserToRoom,
  removeUserFromRoom,
  addOperation,
  pushToUndoStack,
  clearRedoStack,
  resolveUndo,
  resolveRedo,
  getUndoRedoState,
  clearUserHistory,
} from '../services/roomService.js';
import logger from '../utils/logger.js';

/** @type {Map<string, {userId: string, roomId: string|null}>} */
const sessions = new Map();

export function registerHandlers(io) {
  io.on('connection', (socket) => {
    const userId = crypto.randomUUID();
    sessions.set(socket.id, { userId, roomId: null });
    logger.info({ event: 'socket:connect', userId, socketId: socket.id });

    // ── room:create ──────────────────────────────────────────────────────────
    socket.on(EVENTS.ROOM_CREATE, (_payload, ack) => {
      const start = Date.now();
      try {
        const room = createRoom();
        const session = sessions.get(socket.id);

        session.roomId = room.roomId;
        socket.join(room.roomId);
        addUserToRoom(room.roomId, session.userId);

        logger.info({
          event: EVENTS.ROOM_CREATE,
          roomId: room.roomId,
          userId: session.userId,
          durationMs: Date.now() - start,
        });

        if (typeof ack === 'function') {
          ack({ ok: true, roomId: room.roomId, userId: session.userId });
        }

        socket.emit(SERVER_EVENTS.UNDO_STATE, getUndoRedoState(room.roomId, session.userId));
      } catch (err) {
        logger.error({ event: EVENTS.ROOM_CREATE, error: err.message });
        if (typeof ack === 'function') {
          ack({ ok: false, error: ERROR_CODES.SERVER_ERROR, message: 'Failed to generate room' });
        }
      }
    });

    // ── room:join ────────────────────────────────────────────────────────────
    socket.on(EVENTS.ROOM_JOIN, (payload, ack) => {
      const start = Date.now();
      const { roomId, lastSequence = 0 } = payload || {};
      const session = sessions.get(socket.id);

      const room = getRoom(roomId);
      if (!room) {
        logger.warn({ event: EVENTS.ROOM_JOIN, roomId, userId: session.userId, error: ERROR_CODES.ROOM_NOT_FOUND });
        if (typeof ack === 'function') {
          ack({ ok: false, error: ERROR_CODES.ROOM_NOT_FOUND, message: `Room ${roomId} does not exist` });
        }
        return;
      }

      session.roomId = roomId;
      socket.join(roomId);
      addUserToRoom(roomId, session.userId);

      const operations = lastSequence > 0
        ? room.operations.filter((op) => op.sequenceNumber > lastSequence)
        : room.operations;

      logger.info({
        event: EVENTS.ROOM_JOIN,
        roomId,
        userId: session.userId,
        opCount: operations.length,
        durationMs: Date.now() - start,
      });

      if (typeof ack === 'function') {
        ack({ ok: true, operations, userId: session.userId });
      }

      socket.emit(SERVER_EVENTS.UNDO_STATE, getUndoRedoState(roomId, session.userId));
    });

    // ── draw:stroke ──────────────────────────────────────────────────────────
    socket.on(EVENTS.DRAW_STROKE, (payload) => {
      const start = Date.now();
      const session = sessions.get(socket.id);
      if (!session?.roomId) return;

      const { operationId, type, points, color, brushSize } = payload || {};
      if (!operationId || ![OP_TYPE.DRAW, OP_TYPE.ERASE].includes(type) || !Array.isArray(points)) return;

      const fullOp = addOperation(session.roomId, {
        operationId,
        type,
        userId: session.userId,
        points,
        color,
        brushSize,
      });

      if (!fullOp) return; // duplicate or invalid room

      // Clear redo stack on new draw (FR-007)
      clearRedoStack(session.roomId, session.userId);

      // Push to user's undo stack
      pushToUndoStack(session.roomId, session.userId, { ...fullOp });

      socket.to(session.roomId).emit(SERVER_EVENTS.DRAW_BROADCAST, fullOp);

      // Emit updated undo:state to the drawing user
      socket.emit(SERVER_EVENTS.UNDO_STATE, getUndoRedoState(session.roomId, session.userId));

      logger.info({
        event: EVENTS.DRAW_STROKE,
        roomId: session.roomId,
        userId: session.userId,
        operationId,
        type,
        color,
        brushSize,
        durationMs: Date.now() - start,
      });
    });

    // ── canvas:clear ─────────────────────────────────────────────────────────
    socket.on(EVENTS.CANVAS_CLEAR, (payload) => {
      const start = Date.now();
      const session = sessions.get(socket.id);
      if (!session?.roomId) return;

      const { operationId } = payload || {};
      if (!operationId) return;

      const fullOp = addOperation(session.roomId, {
        operationId,
        type: OP_TYPE.CLEAR,
        userId: session.userId,
        points: [],
      });

      if (!fullOp) return;

      // Set room-level latestClearEntry (replacing any previous one)
      const room = getRoom(session.roomId);
      if (room) {
        room.latestClearEntry = { operationId, timestamp: fullOp.timestamp };
        // Push clear onto originating user's undo stack
        pushToUndoStack(session.roomId, session.userId, { ...fullOp });
      }

      io.to(session.roomId).emit(SERVER_EVENTS.CANVAS_CLEARED, fullOp);

      // Emit updated undo:state to every socket in the room (all gain canUndo=true)
      const socketsInRoom = io.sockets.adapter.rooms.get(session.roomId);
      if (socketsInRoom) {
        for (const socketId of socketsInRoom) {
          const targetSession = sessions.get(socketId);
          if (targetSession) {
            io.to(socketId).emit(SERVER_EVENTS.UNDO_STATE, getUndoRedoState(session.roomId, targetSession.userId));
          }
        }
      }

      logger.info({
        event: EVENTS.CANVAS_CLEAR,
        roomId: session.roomId,
        userId: session.userId,
        operationId,
        durationMs: Date.now() - start,
      });
    });

    // ── stroke:preview ────────────────────────────────────────────────────────
    socket.on(EVENTS.STROKE_PREVIEW, (payload) => {
      const session = sessions.get(socket.id);
      if (!session?.roomId) return;

      const { operationId, userId: payloadUserId, type, points } = payload || {};

      if (payloadUserId !== session.userId) {
        logger.warn({ event: EVENTS.STROKE_PREVIEW, socketId: socket.id, receivedUserId: payloadUserId });
        return;
      }
      if (!operationId) return;
      if (!Array.isArray(points)) return;
      if (![OP_TYPE.DRAW, OP_TYPE.ERASE].includes(type)) return;

      socket.to(session.roomId).emit(SERVER_EVENTS.STROKE_PREVIEW_BROADCAST, payload);
    });

    // ── stroke:cancel ─────────────────────────────────────────────────────────
    socket.on(EVENTS.STROKE_CANCEL, (payload) => {
      const session = sessions.get(socket.id);
      if (!session?.roomId) return;

      const { operationId, userId: payloadUserId } = payload || {};

      if (payloadUserId !== session.userId) {
        logger.warn({ event: EVENTS.STROKE_CANCEL, socketId: socket.id, receivedUserId: payloadUserId });
        return;
      }
      if (!operationId) return;

      socket.to(session.roomId).emit(SERVER_EVENTS.STROKE_CANCEL_BROADCAST, {
        operationId,
        userId: session.userId,
      });
    });

    // ── undo:request ─────────────────────────────────────────────────────────
    socket.on(EVENTS.UNDO_REQUEST, () => {
      const start = Date.now();
      const session = sessions.get(socket.id);
      if (!session?.roomId) return;

      const result = resolveUndo(session.roomId, session.userId);
      if (!result) return; // nothing to undo — silent no-op

      const broadcastPayload = { type: result.type, operationId: result.operationId, userId: result.userId };
      io.to(session.roomId).emit(SERVER_EVENTS.UNDO_BROADCAST, broadcastPayload);

      if (result.type === OP_TYPE.CLEAR) {
        // Clear undo affects all users — emit undo:state to everyone
        const socketsInRoom = io.sockets.adapter.rooms.get(session.roomId);
        if (socketsInRoom) {
          for (const socketId of socketsInRoom) {
            const targetSession = sessions.get(socketId);
            if (targetSession) {
              io.to(socketId).emit(SERVER_EVENTS.UNDO_STATE, getUndoRedoState(session.roomId, targetSession.userId));
            }
          }
        }
        logger.info({ event: EVENTS.UNDO_REQUEST, roomId: session.roomId, userId: session.userId, operationId: result.operationId, clearedByUserId: result.userId, durationMs: Date.now() - start });
      } else {
        // Personal stroke undo — emit undo:state to originator only
        socket.emit(SERVER_EVENTS.UNDO_STATE, getUndoRedoState(session.roomId, session.userId));
        logger.info({ event: EVENTS.UNDO_REQUEST, roomId: session.roomId, userId: session.userId, operationId: result.operationId, type: result.type, durationMs: Date.now() - start });
      }
    });

    // ── redo:request ─────────────────────────────────────────────────────────
    socket.on(EVENTS.REDO_REQUEST, () => {
      const start = Date.now();
      const session = sessions.get(socket.id);
      if (!session?.roomId) return;

      const result = resolveRedo(session.roomId, session.userId);
      if (!result) return; // nothing to redo — silent no-op

      io.to(session.roomId).emit(SERVER_EVENTS.REDO_BROADCAST, { operation: result.operation, userId: result.userId });
      socket.emit(SERVER_EVENTS.UNDO_STATE, getUndoRedoState(session.roomId, session.userId));

      logger.info({ event: EVENTS.REDO_REQUEST, roomId: session.roomId, userId: session.userId, operationId: result.operation.operationId, type: result.operation.type, durationMs: Date.now() - start });
    });

    // ── disconnect ───────────────────────────────────────────────────────────
    socket.on('disconnect', () => {
      const session = sessions.get(socket.id);
      if (session?.roomId) {
        clearUserHistory(session.roomId, session.userId);
        socket.to(session.roomId).emit(SERVER_EVENTS.USER_LEFT, { userId: session.userId });
        removeUserFromRoom(session.roomId, session.userId);
      }
      sessions.delete(socket.id);
      logger.info({ event: 'socket:disconnect', userId: session?.userId, socketId: socket.id });
    });
  });
}
