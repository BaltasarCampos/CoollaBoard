import { useState, useEffect, useCallback } from 'react';
import { getSocket } from '../services/socket.js';
import { SERVER_EVENTS, OP_TYPE } from 'shared/constants.js';

export function useCanvas(initialOperations) {
  const [operations, setOperations] = useState(initialOperations ?? []);

  const addOperation = useCallback((op) => {
    setOperations((prev) => {
      // Deduplicate by operationId
      if (prev.some((o) => o.operationId === op.operationId)) return prev;
      return [...prev, op];
    });
  }, []);

  const removeOperation = useCallback((operationId) => {
    setOperations((prev) => {
      if (!prev.some((o) => o.operationId === operationId)) return prev;
      return prev.filter((o) => o.operationId !== operationId);
    });
  }, []);

  // Subscribe to remote draw broadcasts and canvas:cleared
  useEffect(() => {
    const socket = getSocket();
    function onBroadcast(op) {
      addOperation(op);
    }
    function onCleared(op) {
      addOperation(op);
    }
    socket.on(SERVER_EVENTS.DRAW_BROADCAST, onBroadcast);
    socket.on(SERVER_EVENTS.CANVAS_CLEARED, onCleared);
    return () => {
      socket.off(SERVER_EVENTS.DRAW_BROADCAST, onBroadcast);
      socket.off(SERVER_EVENTS.CANVAS_CLEARED, onCleared);
    };
  }, [addOperation]);

  /**
   * Convergence algorithm:
   * 1. Find the last CLEAR operation index.
   * 2. Discard all ops at or before that index.
   * 3. Return remaining ops sorted by sequenceNumber.
   */
  function getVisibleOperations() {
    const sorted = [...operations].sort((a, b) => {
      const tDiff = (a.timestamp ?? 0) - (b.timestamp ?? 0);
      return tDiff !== 0 ? tDiff : (a.sequenceNumber ?? 0) - (b.sequenceNumber ?? 0);
    });
    let clearIndex = -1;
    for (let i = sorted.length - 1; i >= 0; i--) {
      if (sorted[i].type === OP_TYPE.CLEAR) {
        clearIndex = i;
        break;
      }
    }
    return clearIndex >= 0 ? sorted.slice(clearIndex + 1) : sorted;
  }

  return { operations, addOperation, removeOperation, getVisibleOperations };
}
