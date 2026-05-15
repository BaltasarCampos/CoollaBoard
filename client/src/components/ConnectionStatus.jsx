import React, { useState, useEffect } from 'react';
import { onConnectionStatus, offConnectionStatus } from '../services/socket.js';
import { CONNECTION_STATUS } from 'shared/constants.js';

const STYLES = {
  [CONNECTION_STATUS.CONNECTED]:    { backgroundColor: '#4caf50', color: '#fff' },
  [CONNECTION_STATUS.RECONNECTING]: { backgroundColor: '#ff9800', color: '#fff' },
  [CONNECTION_STATUS.DISCONNECTED]: { backgroundColor: '#f44336', color: '#fff' },
};

export default function ConnectionStatus() {
  const [status, setStatus] = useState(CONNECTION_STATUS.DISCONNECTED);

  useEffect(() => {
    onConnectionStatus(setStatus);
    return () => offConnectionStatus(setStatus);
  }, []);

  const style = {
    position: 'fixed',
    bottom: '1rem',
    right: '1rem',
    padding: '0.25rem 0.75rem',
    borderRadius: '9999px',
    fontSize: '0.75rem',
    fontWeight: 'bold',
    zIndex: 9999,
    ...STYLES[status],
  };

  return <span data-testid="connection-status" style={style}>{status}</span>;
}
