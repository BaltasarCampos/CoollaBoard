import React, { useState } from 'react';
import HomePage from './components/HomePage.jsx';
import RoomPage from './components/RoomPage.jsx';

export default function App() {
  const [roomId, setRoomId]         = useState(null);
  const [userId, setUserId]         = useState(null);
  const [message, setMessage]       = useState('');
  const [initialOps, setInitialOps] = useState([]);

  function handleRoomJoined({ roomId: rid, userId: uid, operations = [] }) {
    setRoomId(rid);
    setUserId(uid);
    setMessage('');
    setInitialOps(operations);
  }

  function handleLeaveRoom(msg = '') {
    setRoomId(null);
    setUserId(null);
    setMessage(msg);
    setInitialOps([]);
  }

  if (roomId) {
    return (
      <RoomPage
        roomId={roomId}
        userId={userId}
        initialOperations={initialOps}
        onLeaveRoom={handleLeaveRoom}
      />
    );
  }

  return (
    <HomePage
      onRoomJoined={handleRoomJoined}
      message={message}
    />
  );
}
