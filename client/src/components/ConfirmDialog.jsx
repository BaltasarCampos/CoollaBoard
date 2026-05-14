import React from 'react';

export default function ConfirmDialog({ onConfirm, onCancel }) {
  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '0.5rem',
      padding: '0.5rem',
      background: '#fff3cd',
      border: '1px solid #ffc107',
      borderRadius: '4px',
    }}>
      <span>Are you sure?</span>
      <button onClick={onConfirm}>Confirm</button>
      <button onClick={onCancel}>Cancel</button>
    </div>
  );
}
