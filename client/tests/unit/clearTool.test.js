import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/services/socket.js', () => ({
  emitClear: vi.fn(),
  getSocket: vi.fn(() => ({ on: vi.fn(), off: vi.fn() })),
}));

import * as socketService from '../../src/services/socket.js';
import { createClearTool } from '../../src/tools/clearTool.js';

describe('clearTool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('emitClear() calls socket emitClear with a UUID v4 operationId', () => {
    const tool = createClearTool();
    tool.emitClear();

    expect(socketService.emitClear).toHaveBeenCalledTimes(1);
    const [opId] = socketService.emitClear.mock.calls[0];
    expect(opId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('emitClear() calls emitClear with a new UUID each time', () => {
    const tool = createClearTool();
    tool.emitClear();
    tool.emitClear();

    const [id1] = socketService.emitClear.mock.calls[0];
    const [id2] = socketService.emitClear.mock.calls[1];
    expect(id1).not.toBe(id2);
  });
});
