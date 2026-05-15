import React, { useState } from 'react';
import ConfirmDialog from './ConfirmDialog.jsx';
import { TOOL_NAMES } from 'shared/constants.js';
import { clearCanvas } from '../hooks/useRoom.js';

export default function Toolbar({ activeTool, onToolChange, onClear = clearCanvas }) {
  const [showConfirm, setShowConfirm] = useState(false);

  function handleConfirmClear() {
    onClear();
    setShowConfirm(false);
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem' }}>
      <button
        onClick={() => onToolChange(TOOL_NAMES.PEN)}
        style={{ fontWeight: activeTool === TOOL_NAMES.PEN ? 'bold' : 'normal' }}
      >
        Pen
      </button>
      <button
        onClick={() => onToolChange(TOOL_NAMES.ERASER)}
        style={{ fontWeight: activeTool === TOOL_NAMES.ERASER ? 'bold' : 'normal' }}
      >
        Eraser
      </button>
      <button onClick={() => setShowConfirm(true)}>
        Clear Canvas
      </button>
      {showConfirm && (
        <ConfirmDialog
          onConfirm={handleConfirmClear}
          onCancel={() => setShowConfirm(false)}
        />
      )}
    </div>
  );
}
