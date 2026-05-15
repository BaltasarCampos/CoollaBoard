import React, { useState, useCallback } from 'react';
import ConnectionStatus from './ConnectionStatus.jsx';
import Canvas from './Canvas.jsx';
import Toolbar from './Toolbar.jsx';
import { useRoom } from '../hooks/useRoom.js';
import { TOOL_NAMES } from 'shared/constants.js';

export default function RoomPage({ roomId, userId, onLeaveRoom, initialOperations = [] }) {
  const [activeTool, setActiveTool] = useState(TOOL_NAMES.PEN);
  const [operations, setOperations] = useState(initialOperations);

  const addOperations = useCallback((ops) => {
    setOperations((prev) => {
      const existingIds = new Set(prev.map((o) => o.operationId));
      const newOps = ops.filter((o) => !existingIds.has(o.operationId));
      return newOps.length ? [...prev, ...newOps] : prev;
    });
  }, []);

  const { handleClear } = useRoom({
    roomId,
    userId,
    onRoomJoined: () => {},
    onLeaveRoom,
    addOperations,
    operations,
    skipInitialJoin: true,
  });

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
        <Toolbar activeTool={activeTool} onToolChange={setActiveTool} onClear={handleClear} />
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
