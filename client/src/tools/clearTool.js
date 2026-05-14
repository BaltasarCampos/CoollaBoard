import { emitClear } from '../services/socket.js';

export function createClearTool() {
  function emitClearAction() {
    const operationId = crypto.randomUUID();
    emitClear(operationId);
  }

  return { emitClear: emitClearAction };
}
