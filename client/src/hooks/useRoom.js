import { useEffect, useRef } from 'react';
import {
  createRoom,
  joinRoom,
  getSocket,
  onConnectionStatus,
  offConnectionStatus,
} from '../services/socket.js';
import { SERVER_EVENTS } from 'shared/constants.js';

/**
 * Manages joining/creating a room and socket lifecycle.
 *
 * @param {object} params
 * @param {string|null} params.roomId  - null → create a new room; string → join existing
 * @param {string|null} [params.userId]
 * @param {number}  [params.lastSequence] - for delta re-join on reconnect
 * @param {function} params.onRoomJoined  - called with {roomId, userId, operations}
 * @param {function} params.onLeaveRoom   - called with optional message string
 */
export function useRoom({ roomId, userId, lastSequence, onRoomJoined, onLeaveRoom }) {
  const onLeaveRoomRef = useRef(onLeaveRoom);
  onLeaveRoomRef.current = onLeaveRoom;

  useEffect(() => {
    let cancelled = false;

    async function enter() {
      try {
        if (!roomId) {
          const result = await createRoom();
          if (!cancelled) onRoomJoined(result);
        } else {
          const result = await joinRoom(roomId, lastSequence);
          if (!cancelled) onRoomJoined({ roomId, userId, ...result });
        }
      } catch (err) {
        if (!cancelled) onLeaveRoomRef.current(err.message === 'ROOM_NOT_FOUND' ? 'room no longer exists' : err.message);
      }
    }

    enter();

    const socket = getSocket();

    function onRoomError(data) {
      if (!cancelled && data?.error === 'ROOM_NOT_FOUND') {
        onLeaveRoomRef.current('room no longer exists');
      }
    }

    socket.on(SERVER_EVENTS.ROOM_ERROR, onRoomError);

    return () => {
      cancelled = true;
      socket.off(SERVER_EVENTS.ROOM_ERROR, onRoomError);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);
}
