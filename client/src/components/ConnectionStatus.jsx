import React, { useState, useEffect } from 'react';
import { onConnectionStatus, offConnectionStatus } from '../services/socket.js';
import { CONNECTION_STATUS } from 'shared/constants.js';
import '../styles/components/connectionstatus.css';

const STATUS_CLASS = {
  [CONNECTION_STATUS.CONNECTED]:    'connection-status--connected',
  [CONNECTION_STATUS.RECONNECTING]: 'connection-status--reconnecting',
  [CONNECTION_STATUS.DISCONNECTED]: 'connection-status--disconnected',
};

export default function ConnectionStatus() {
  const [status, setStatus] = useState(CONNECTION_STATUS.DISCONNECTED);

  useEffect(() => {
    onConnectionStatus(setStatus);
    return () => offConnectionStatus(setStatus);
  }, []);

  return (
    <span
      data-testid="connection-status"
      className={`connection-status ${STATUS_CLASS[status]}`}
    >
      {status}
    </span>
  );
}
