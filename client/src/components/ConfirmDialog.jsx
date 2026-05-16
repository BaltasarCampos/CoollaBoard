import React from 'react';
import '../styles/components/confirmdialog.css';

export default function ConfirmDialog({ onConfirm, onCancel }) {
  return (
    <div className="confirm-dialog">
      <span>Are you sure?</span>
      <button className="btn" onClick={onConfirm}>Confirm</button>
      <button className="btn" onClick={onCancel}>Cancel</button>
    </div>
  );
}
