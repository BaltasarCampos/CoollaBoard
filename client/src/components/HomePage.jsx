import React from 'react';
import { useHomePage } from '../hooks/useHomePage.js';
import { ROOM_ID_LENGTH } from 'shared/constants.js';

export default function HomePage({ onRoomJoined, message }) {
  const { input, error, loading, handleInputChange, handleCreate, handleJoin } = useHomePage({ onRoomJoined });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '2rem', gap: '1rem' }}>
      <h1>CoollaBoard</h1>

      {message && <p style={{ color: 'orange' }}>{message}</p>}

      <button onClick={handleCreate} disabled={loading}>
        Create Room
      </button>

      <hr style={{ width: '100%' }} />

      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <input
          type="text"
          placeholder="Room ID"
          value={input}
          onChange={handleInputChange}
          maxLength={ROOM_ID_LENGTH}
          style={{ textTransform: 'uppercase' }}
        />
        <button onClick={handleJoin} disabled={loading}>
          Join Room
        </button>
      </div>

      {error && <p style={{ color: 'red' }}>{error}</p>}
    </div>
  );
}
