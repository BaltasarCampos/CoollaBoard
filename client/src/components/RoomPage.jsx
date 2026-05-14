import React, { useState, useEffect, useCallback } from 'react';
import ConnectionStatus from './ConnectionStatus.jsx';
import Canvas from './Canvas.jsx';
import Toolbar from './Toolbar.jsx';
import { getSocket, joinRoom } from '../services/socket.js';
import { SERVER_EVENTS } from 'shared/constants.js';

export default function RoomPage({ roomId, userId, onLeaveRoom, initialOperations = [] }) {
  const [activeTool, setActiveTool] = useState('pen');
  const [operations, setOperations] = useState(initialOperations);

  const addOperations = useCallback((ops) => {
    setOperations((prev) => {
      const existingIds = new Set(prev.map((o) => o.operationId));
      const newOps = ops.filter((o) => !existingIds.has(o.operationId));
      return newOps.length ? [...prev, ...newOps] : prev;
    });
  }, []);

  // Delta-hydration on reconnect: re-join with lastSequence to get missed ops
  useEffect(() => {
    const socket = getSocket();

    async function onReconnect() {
      try {
        setOperations((prev) => {
          const lastSequence = prev.reduce((max, op) => Math.max(max, op.sequenceNumber ?? 0), 0);
          // Fire the rejoin asynchronously outside the state updater
          joinRoom(roomId, lastSequence || undefined)
            .then(({ operations: delta }) => {
              if (delta.length) addOperations(delta);
            })
            .catch(() => onLeaveRoom('room no longer exists'));
          return prev;
        });
      } catch {
        onLeaveRoom('room no longer exists');
      }
    }

    function onRoomError(data) {
      if (data?.error === 'ROOM_NOT_FOUND') onLeaveRoom('room no longer exists');
    }

    socket.on('reconnect', onReconnect);
    socket.on(SERVER_EVENTS.ROOM_ERROR, onRoomError);
    return () => {
      socket.off('reconnect', onReconnect);
      socket.off(SERVER_EVENTS.ROOM_ERROR, onRoomError);
    };
  }, [roomId, addOperations, onLeaveRoom]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0.5rem 1rem',
        borderBottom: '1px solid #ddd',
      }}>
        <span data-testid="room-id" style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{roomId}</span>
        <Toolbar activeTool={activeTool} onToolChange={setActiveTool} />
        <button onClick={() => onLeaveRoom('')}>Leave</button>
      </div>

      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <Canvas
          activeTool={activeTool}
          roomId={roomId}
          userId={userId}
          initialOperations={operations}
        />
      </div>

      <ConnectionStatus />
    </div>
  );
}
