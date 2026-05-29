import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ParticipantsPanel from '../../src/components/ParticipantsPanel.jsx';

describe('ParticipantsPanel', () => {
  const participants = [
    { userId: 'u1', displayName: 'Alice' },
    { userId: 'u2', displayName: 'Bob' },
  ];

  // ── US1: Rendering ────────────────────────────────────────────────────────

  it('renders a list of participant names', () => {
    render(
      <ParticipantsPanel
        participants={participants}
        isLoading={false}
        currentUserId="u3"
      />
    );

    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  it('shows "Loading…" when isLoading is true', () => {
    render(
      <ParticipantsPanel
        participants={[]}
        isLoading={true}
        currentUserId="u1"
      />
    );

    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });

  it('renders correctly with an empty participants list', () => {
    render(
      <ParticipantsPanel
        participants={[]}
        isLoading={false}
        currentUserId="u1"
      />
    );

    // No participant names, no loading message
    expect(screen.queryByText('Loading…')).not.toBeInTheDocument();
    // a list exists but is empty
    expect(screen.getByRole('list')).toBeInTheDocument();
    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
  });

  // ── US3: Self-identification ──────────────────────────────────────────────

  it('appends "(You)" to the current user\'s entry', () => {
    render(
      <ParticipantsPanel
        participants={participants}
        isLoading={false}
        currentUserId="u1"
      />
    );

    expect(screen.getByText('Alice (You)')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  it('applies self CSS class only to the current user\'s entry', () => {
    render(
      <ParticipantsPanel
        participants={participants}
        isLoading={false}
        currentUserId="u1"
      />
    );

    const selfItem = screen.getByText('Alice (You)').closest('li');
    const otherItem = screen.getByText('Bob').closest('li');

    expect(selfItem).toHaveClass('participants-panel__item--self');
    expect(otherItem).not.toHaveClass('participants-panel__item--self');
  });

  it('does not apply self class when no participant matches currentUserId', () => {
    render(
      <ParticipantsPanel
        participants={participants}
        isLoading={false}
        currentUserId="u99"
      />
    );

    const items = screen.getAllByRole('listitem');
    items.forEach((item) => {
      expect(item).not.toHaveClass('participants-panel__item--self');
    });
  });
});
