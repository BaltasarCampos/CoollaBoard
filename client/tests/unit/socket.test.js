import { describe, it, expect, vi, beforeEach } from 'vitest';

// Proper mock socket that tracks listeners and can simulate events
const listeners = new Map();

const mockSocket = {
  emit: vi.fn(),
  on: vi.fn((event, cb) => { listeners.set(event, cb); }),
  off: vi.fn(),
  connect: vi.fn(),
  disconnect: vi.fn(),
  connected: false,
  id: 'mock-socket-id',
};

vi.mock('socket.io-client', () => ({
  io: vi.fn(() => mockSocket),
}));

const socketModule = await import('../../src/services/socket.js');

describe('socket.js adapter', () => {
  beforeEach(() => {
    mockSocket.emit.mockReset();
  });

  it('createRoom() resolves with {roomId, userId} on ok:true ack', async () => {
    mockSocket.emit.mockImplementation((event, payload, cb) => {
      if (event === 'room:create') cb({ ok: true, roomId: 'ABC123', userId: 'user-1' });
    });

    const result = await socketModule.createRoom();
    expect(result.roomId).toBe('ABC123');
    expect(result.userId).toBe('user-1');
  });

  it('joinRoom(roomId) resolves with {operations:[]} on ok:true ack', async () => {
    mockSocket.emit.mockImplementation((event, payload, cb) => {
      if (event === 'room:join') cb({ ok: true, operations: [] });
    });

    const result = await socketModule.joinRoom('ABC123');
    expect(result.operations).toEqual([]);
  });

  it('joinRoom() for unknown room rejects with ROOM_NOT_FOUND', async () => {
    mockSocket.emit.mockImplementation((event, payload, cb) => {
      if (event === 'room:join') cb({ ok: false, error: 'ROOM_NOT_FOUND' });
    });

    await expect(socketModule.joinRoom('BADROM')).rejects.toThrow('ROOM_NOT_FOUND');
  });

  it('onConnectionStatus callback fires on connect event', () => {
    const cb = vi.fn();
    socketModule.onConnectionStatus(cb);

    // Simulate the connect event via the tracked listener
    const connectHandler = listeners.get('connect');
    expect(connectHandler).toBeDefined();
    connectHandler();

    expect(cb).toHaveBeenCalledWith('Connected');
    socketModule.offConnectionStatus(cb);
  });

  it('emitLeaveRoom() emits room:leave with the roomId', () => {
    socketModule.emitLeaveRoom('ABC123');
    expect(mockSocket.emit).toHaveBeenCalledWith('room:leave', { roomId: 'ABC123' });
  });
});
