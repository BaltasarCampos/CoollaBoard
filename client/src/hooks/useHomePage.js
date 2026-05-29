import { useState } from 'react';
import { createRoom, joinRoom } from '../services/socket.js';
import { ROOM_ID_LENGTH, ROOM_ID_ALPHABET, ERROR_CODES } from 'shared/constants.js';

const ROOM_ID_PATTERN = new RegExp(`^[${ROOM_ID_ALPHABET}]{${ROOM_ID_LENGTH}}$`);

export function useHomePage({ onRoomJoined }) {
  const [input, setInput]               = useState('');
  const [displayName, setDisplayName]   = useState('');
  const [error, setError]               = useState('');
  const [loading, setLoading]           = useState(false);

  function handleInputChange(e) {
    setInput(e.target.value.toUpperCase());
    setError('');
  }

  function handleDisplayNameChange(e) {
    setDisplayName(e.target.value);
    setError('');
  }

  const isDisplayNameValid = displayName.trim().length > 0 && displayName.trim().length <= 30;

  async function handleCreate() {
    if (loading) return;
    setLoading(true);
    setError('');
    try {
      const result = await createRoom(displayName.trim());
      onRoomJoined(result);
    } catch {
      setError('Failed to create room. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleJoin() {
    if (loading) return;
    const roomId = input.trim().toUpperCase();

    if (roomId.length !== ROOM_ID_LENGTH) {
      setError(`Room ID must be exactly ${ROOM_ID_LENGTH} characters.`);
      return;
    }
    if (!ROOM_ID_PATTERN.test(roomId)) {
      setError('Room ID must contain only letters and numbers.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const result = await joinRoom(roomId, displayName.trim());
      onRoomJoined({ roomId, ...result });
    } catch (err) {
      if (err.message === ERROR_CODES.ROOM_NOT_FOUND) {
        setError('Room not found. Please check the ID and try again.');
      } else {
        setError('Failed to join room. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  return { input, displayName, isDisplayNameValid, error, loading, handleInputChange, handleDisplayNameChange, handleCreate, handleJoin };
}
