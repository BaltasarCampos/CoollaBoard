import React, { useState, useCallback, useEffect, useRef } from 'react';
import ConnectionStatus from './ConnectionStatus.jsx';
import Canvas from './Canvas.jsx';
import Toolbar from './Toolbar.jsx';
import ParticipantsPanel from './ParticipantsPanel.jsx';
import { useRoom } from '../hooks/useRoom.js';
import { useCanvas } from '../hooks/useCanvas.js';
import { useUndoRedo } from '../hooks/useUndoRedo.js';
import { useParticipants } from '../hooks/useParticipants.js';
import { getSocket, emitLeaveRoom } from '../services/socket.js';
import { TOOL_NAMES, DEFAULT_STROKE_COLOR, DEFAULT_BRUSH_WIDTH, SERVER_EVENTS } from 'shared/constants.js';
import '../styles/components/roompage.css';

export default function RoomPage({ roomId, userId, onLeaveRoom, initialOperations = [], initialParticipants = [] }) {
  const [activeTool, setActiveTool] = useState(TOOL_NAMES.PEN);
  const [color, setColor] = useState(DEFAULT_STROKE_COLOR);
  const [brushSize, setBrushSize] = useState(DEFAULT_BRUSH_WIDTH);

  const { operations, addOperation, removeOperation, getVisibleOperations } = useCanvas(initialOperations);
  const { canUndo, canRedo, requestUndo, requestRedo } = useUndoRedo({ removeOperation, addOperation });
  const { participants, isLoading: participantsLoading } = useParticipants(initialParticipants);

  const onExternalClearRef = useRef(null);

  // Flush Canvas previews when canvas is cleared externally
  useEffect(() => {
    const socket = getSocket();
    function onCleared() {
      onExternalClearRef.current?.();
    }
    socket.on(SERVER_EVENTS.CANVAS_CLEARED, onCleared);
    return () => {
      socket.off(SERVER_EVENTS.CANVAS_CLEARED, onCleared);
    };
  }, []);

  const { handleClear } = useRoom({
    roomId,
    userId,
    onRoomJoined: () => {},
    onLeaveRoom,
    addOperations: (ops) => ops.forEach(addOperation),
    operations,
    skipInitialJoin: true,
  });

  return (
    <div className="room-page">
      <div className="room-page__header">
        <span data-testid="room-id" className="room-page__room-id">{roomId}</span>
        <button className="btn" onClick={() => { emitLeaveRoom(roomId); onLeaveRoom(''); }}>Leave</button>
      </div>

      <div className="room-page__canvas-area">
        <Toolbar
          activeTool={activeTool}
          onToolChange={setActiveTool}
          onClear={handleClear}
          color={color}
          onColorChange={setColor}
          brushSize={brushSize}
          onBrushSizeChange={setBrushSize}
          canUndo={canUndo}
          canRedo={canRedo}
          onUndo={requestUndo}
          onRedo={requestRedo}
        />
        <Canvas
          addOperation={addOperation}
          removeOperation={removeOperation}
          getVisibleOperations={getVisibleOperations}
          canUndo={canUndo}
          canRedo={canRedo}
          requestUndo={requestUndo}
          requestRedo={requestRedo}
          onExternalClear={onExternalClearRef}
          activeTool={activeTool}
          color={color}
          brushSize={brushSize}
          roomId={roomId}
          userId={userId}
        />
      </div>

      <ParticipantsPanel
        participants={participants}
        isLoading={participantsLoading}
        currentUserId={userId}
      />

      <ConnectionStatus />
    </div>
  );
}

