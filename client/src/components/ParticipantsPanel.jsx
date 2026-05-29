import React from 'react';
import '../styles/components/participantspanel.css';

export default function ParticipantsPanel({ participants, isLoading, currentUserId }) {
  return (
    <aside className="participants-panel">
      <p className="participants-panel__title">Participants</p>
      {isLoading ? (
        <p className="participants-panel__loading">Loading…</p>
      ) : (
        <ul className="participants-panel__list">
          {participants.map(({ userId, displayName }) => {
            const isSelf = userId === currentUserId;
            return (
              <li
                key={userId}
                className={`participants-panel__item${isSelf ? ' participants-panel__item--self' : ''}`}
              >
                {isSelf ? `${displayName} (You)` : displayName}
              </li>
            );
          })}
        </ul>
      )}
    </aside>
  );
}
