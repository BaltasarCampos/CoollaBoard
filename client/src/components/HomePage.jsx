import React, { useState } from 'react';
import { createRoom, joinRoom } from '../services/socket.js';

const ROOM_ID_PATTERN = /^[A-Z0-9]{6}$/;

export default function HomePage({ onRoomJoined, message }) {
  const [input, setInput]       = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  function handleInputChange(e) {
    setInput(e.target.value.toUpperCase());
    setError('');
  }

  async function handleCreate() {
    setLoading(true);
    setError('');
    try {
      const result = await createRoom();
      onRoomJoined(result);
    } catch (err) {
      setError('Failed to create room. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleJoin() {
    const roomId = input.trim().toUpperCase();

    if (roomId.length !== 6) {
      setError('Room ID must be exactly 6 characters.');
      return;
    }
    if (!ROOM_ID_PATTERN.test(roomId)) {
      setError('Room ID must contain only letters and numbers.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const result = await joinRoom(roomId);
      onRoomJoined({ roomId, ...result });
    } catch (err) {
      if (err.message === 'ROOM_NOT_FOUND') {
        setError('Room not found. Please check the ID and try again.');
      } else {
        setError('Failed to join room. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

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
          maxLength={6}
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
