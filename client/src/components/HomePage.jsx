import React from 'react';
import { useHomePage } from '../hooks/useHomePage.js';
import { ROOM_ID_LENGTH } from 'shared/constants.js';
import '../styles/components/homepage.css';

export default function HomePage({ onRoomJoined, message }) {
  const { input, displayName, isDisplayNameValid, error, loading, handleInputChange, handleDisplayNameChange, handleCreate, handleJoin } = useHomePage({ onRoomJoined });

  return (
    <div className="home-page">
      <h1>CoollaBoard</h1>

      {message && <p className="home-page__message--warning">{message}</p>}

      <div className="home-page__display-name-row">
        <input
          className="input input--display-name"
          type="text"
          placeholder="Your name"
          value={displayName}
          onChange={handleDisplayNameChange}
          maxLength={30}
        />
      </div>

      <button className="btn" onClick={handleCreate} disabled={loading || !isDisplayNameValid}>
        Create Room
      </button>

      <hr className="home-page__divider" />

      <div className="home-page__join-row">
        <input
          className="input input--room-id"
          type="text"
          placeholder="Room ID"
          value={input}
          onChange={handleInputChange}
          maxLength={ROOM_ID_LENGTH}
        />
        <button className="btn" onClick={handleJoin} disabled={loading || !isDisplayNameValid}>
          Join Room
        </button>
      </div>

      {error && <p className="home-page__message--error">{error}</p>}
    </div>
  );
}
