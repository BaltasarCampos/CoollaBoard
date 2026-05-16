import React, { useState } from 'react';
import ConfirmDialog from './ConfirmDialog.jsx';
import { TOOL_NAMES } from 'shared/constants.js';
import { clearCanvas } from '../hooks/useRoom.js';
import '../styles/components/toolbar.css';

export default function Toolbar({ activeTool, onToolChange, onClear = clearCanvas }) {
  const [showConfirm, setShowConfirm] = useState(false);

  function handleConfirmClear() {
    onClear();
    setShowConfirm(false);
  }

  return (
    <div className="toolbar">
      <button
        className={`toolbar__btn${activeTool === TOOL_NAMES.PEN ? ' toolbar__btn--active' : ''}`}
        onClick={() => onToolChange(TOOL_NAMES.PEN)}
      >
        Pen
      </button>
      <button
        className={`toolbar__btn${activeTool === TOOL_NAMES.ERASER ? ' toolbar__btn--active' : ''}`}
        onClick={() => onToolChange(TOOL_NAMES.ERASER)}
      >
        Eraser
      </button>
      <button className="toolbar__btn" onClick={() => setShowConfirm(true)}>
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
