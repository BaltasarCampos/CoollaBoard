import React, { useState } from 'react';
import HomePage from './components/HomePage.jsx';
import RoomPage from './components/RoomPage.jsx';

export default function App() {
  const [roomId, setRoomId]                       = useState(null);
  const [userId, setUserId]                       = useState(null);
  const [message, setMessage]                     = useState('');
  const [initialOps, setInitialOps]               = useState([]);
  const [initialParticipants, setInitialParticipants] = useState([]);

  function handleRoomJoined({ roomId: rid, userId: uid, operations = [], participants = [] }) {
    setRoomId(rid);
    setUserId(uid);
    setMessage('');
    setInitialOps(operations);
    setInitialParticipants(participants);
  }

  function handleLeaveRoom(msg = '') {
    setRoomId(null);
    setUserId(null);
    setMessage(msg);
    setInitialOps([]);
    setInitialParticipants([]);
  }

  if (roomId) {
    return (
      <RoomPage
        roomId={roomId}
        userId={userId}
        initialOperations={initialOps}
        initialParticipants={initialParticipants}
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
