import { useState, useEffect } from 'react';
import { getSocket } from '../services/socket.js';
import { SERVER_EVENTS } from 'shared/constants.js';

export function useParticipants(initialParticipants) {
  const [participants, setParticipants] = useState(initialParticipants);
  const isLoading = false;

  useEffect(() => {
    const socket = getSocket();

    function onParticipantsUpdated(data) {
      setParticipants(data.participants);
    }

    socket.on(SERVER_EVENTS.PARTICIPANTS_UPDATED, onParticipantsUpdated);

    return () => {
      socket.off(SERVER_EVENTS.PARTICIPANTS_UPDATED, onParticipantsUpdated);
    };
  }, []);

  return { participants, isLoading };
}
