import React, { useState } from 'react';
import ConfirmDialog from './ConfirmDialog.jsx';
import { TOOL_NAMES, STROKE_PALETTE, BRUSH_PRESETS } from 'shared/constants.js';
import { clearCanvas } from '../hooks/useRoom.js';
import '../styles/components/toolbar.css';

export default function Toolbar({ activeTool, onToolChange, onClear = clearCanvas, color, onColorChange, brushSize, onBrushSizeChange }) {
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
      <div className="toolbar__color-swatches">
        {STROKE_PALETTE.map((hex) => (
          <button
            key={hex}
            className={`toolbar__color-swatch${color === hex ? ' toolbar__color-swatch--active' : ''}`}
            // eslint-disable-next-line react/forbid-component-props
            style={{ background: hex }}
            aria-label={hex}
            onClick={() => onColorChange(hex)}
          />
        ))}
      </div>
      <div className="toolbar__size-btns">
        {BRUSH_PRESETS.map((preset) => (
          <button
            key={preset.value}
            className={`toolbar__size-btn${brushSize === preset.value ? ' toolbar__size-btn--active' : ''}`}
            onClick={() => onBrushSizeChange(preset.value)}
          >
            {preset.label}
          </button>
        ))}
      </div>
      {showConfirm && (
        <ConfirmDialog
          onConfirm={handleConfirmClear}
          onCancel={() => setShowConfirm(false)}
        />
      )}
    </div>
  );
}
