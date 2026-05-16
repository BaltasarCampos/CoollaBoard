import React, { useState, useCallback } from 'react';
import ConnectionStatus from './ConnectionStatus.jsx';
import Canvas from './Canvas.jsx';
import Toolbar from './Toolbar.jsx';
import { useRoom } from '../hooks/useRoom.js';
import { TOOL_NAMES } from 'shared/constants.js';
import '../styles/components/roompage.css';

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
    <div className="room-page">
      <div className="room-page__header">
        <span data-testid="room-id" className="room-page__room-id">{roomId}</span>
        <Toolbar activeTool={activeTool} onToolChange={setActiveTool} onClear={handleClear} />
        <button className="btn" onClick={() => onLeaveRoom('')}>Leave</button>
      </div>

      <div className="room-page__canvas-area">
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
