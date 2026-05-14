import React, { useState } from 'react';
import ConfirmDialog from './ConfirmDialog.jsx';
import { emitClear } from '../services/socket.js';

export default function Toolbar({ activeTool, onToolChange }) {
  const [showConfirm, setShowConfirm] = useState(false);

  function handleConfirmClear() {
    const operationId = crypto.randomUUID();
    emitClear(operationId);
    setShowConfirm(false);
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem' }}>
      <button
        onClick={() => onToolChange('pen')}
        style={{ fontWeight: activeTool === 'pen' ? 'bold' : 'normal' }}
      >
        Pen
      </button>
      <button
        onClick={() => onToolChange('eraser')}
        style={{ fontWeight: activeTool === 'eraser' ? 'bold' : 'normal' }}
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
