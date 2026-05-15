import { useEffect, useRef } from 'react';
import {
  createRoom,
  joinRoom,
  getSocket,
  onConnectionStatus,
  offConnectionStatus,
  emitClear,
} from '../services/socket.js';
import { SERVER_EVENTS, ERROR_CODES } from 'shared/constants.js';

/**
 * Manages joining/creating a room and socket lifecycle.
 *
 * @param {object} params
 * @param {string|null} params.roomId  - null → create a new room; string → join existing
 * @param {string|null} [params.userId]
 * @param {number}  [params.lastSequence] - for delta re-join on reconnect
 * @param {function} params.onRoomJoined  - called with {roomId, userId, operations}
 * @param {function} params.onLeaveRoom   - called with optional message string
 * @param {function} [params.addOperations] - called with delta ops on reconnect
 * @param {Array}   [params.operations]   - current operations array (read via ref for reconnect lastSequence)
 * @param {boolean} [params.skipInitialJoin] - true when room is already joined (e.g., hook is used for reconnect-only in RoomPage)
 */
export function useRoom({ roomId, userId, lastSequence, onRoomJoined, onLeaveRoom, addOperations, operations: allOperations = null, skipInitialJoin = false }) {
  const onLeaveRoomRef    = useRef(onLeaveRoom);
  onLeaveRoomRef.current  = onLeaveRoom;

  const addOperationsRef   = useRef(addOperations);
  addOperationsRef.current = addOperations;

  const allOperationsRef   = useRef(allOperations);
  allOperationsRef.current = allOperations;

  useEffect(() => {
    let cancelled = false;

    async function enter() {
      if (skipInitialJoin) return;
      try {
        if (!roomId) {
          const result = await createRoom();
          if (!cancelled) onRoomJoined(result);
        } else {
          const result = await joinRoom(roomId, lastSequence);
          if (!cancelled) onRoomJoined({ roomId, userId, ...result });
        }
      } catch (err) {
        if (!cancelled) onLeaveRoomRef.current(err.message === ERROR_CODES.ROOM_NOT_FOUND ? 'room no longer exists' : err.message);
      }
    }

    enter();

    const socket = getSocket();

    async function onReconnect() {
      if (cancelled || !roomId) return;
      const currentSeq = (allOperationsRef.current ?? []).reduce(
        (max, op) => Math.max(max, op.sequenceNumber ?? 0), 0
      );
      try {
        const { operations: delta } = await joinRoom(roomId, currentSeq || undefined);
        if (!cancelled && delta?.length && addOperationsRef.current) {
          addOperationsRef.current(delta);
        }
      } catch {
        if (!cancelled) onLeaveRoomRef.current('room no longer exists');
      }
    }

    function onRoomError(data) {
      if (!cancelled && data?.error === ERROR_CODES.ROOM_NOT_FOUND) {
        onLeaveRoomRef.current('room no longer exists');
      }
    }

    socket.on('reconnect', onReconnect);
    socket.on(SERVER_EVENTS.ROOM_ERROR, onRoomError);

    return () => {
      cancelled = true;
      socket.off('reconnect', onReconnect);
      socket.off(SERVER_EVENTS.ROOM_ERROR, onRoomError);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  function handleClear() {
    const operationId = crypto.randomUUID();
    emitClear(operationId);
  }

  return { handleClear };
}

/**
 * Standalone clear action — emits a canvas:clear event with a fresh operationId.
 * Exported for use as a fallback default in Toolbar (satisfies SC-004: Toolbar
 * imports from this hook module, not from services/socket.js directly).
 */
export function clearCanvas() {
  emitClear(crypto.randomUUID());
}
