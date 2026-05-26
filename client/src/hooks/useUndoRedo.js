import { useState, useEffect, useRef, useCallback } from 'react';
import { getSocket } from '../services/socket.js';
import { emitUndoRequest, emitRedoRequest } from '../services/socket.js';
import { SERVER_EVENTS, UNDO_CONFIRM_TIMEOUT_MS } from 'shared/constants.js';

/**
 * useUndoRedo — manages undo/redo availability flags and emits requests to the server.
 *
 * @param {object} params
 * @param {function} params.removeOperation - from useCanvas, removes op by operationId
 * @param {function} params.addOperation    - from useCanvas, adds op back (for redo:broadcast)
 */
export function useUndoRedo({ removeOperation, addOperation }) {
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const pendingRef = useRef(false);
  const pendingTimerRef = useRef(null);

  const clearPending = useCallback(() => {
    if (pendingTimerRef.current !== null) {
      clearTimeout(pendingTimerRef.current);
      pendingTimerRef.current = null;
    }
    pendingRef.current = false;
  }, []);

  const setPending = useCallback(() => {
    pendingRef.current = true;
    pendingTimerRef.current = setTimeout(() => {
      pendingRef.current = false;
      pendingTimerRef.current = null;
    }, UNDO_CONFIRM_TIMEOUT_MS);
  }, []);

  const requestUndo = useCallback(() => {
    if (pendingRef.current) return;
    setPending();
    emitUndoRequest();
  }, [setPending]);

  const requestRedo = useCallback(() => {
    if (pendingRef.current) return;
    setPending();
    emitRedoRequest();
  }, [setPending]);

  useEffect(() => {
    const socket = getSocket();

    function onUndoState({ canUndo: u, canRedo: r }) {
      setCanUndo(u);
      setCanRedo(r);
    }

    function onUndoBroadcast({ operationId }) {
      removeOperation(operationId);
      clearPending();
    }

    function onRedoBroadcast({ operation }) {
      addOperation(operation);
      clearPending();
    }

    socket.on(SERVER_EVENTS.UNDO_STATE, onUndoState);
    socket.on(SERVER_EVENTS.UNDO_BROADCAST, onUndoBroadcast);
    socket.on(SERVER_EVENTS.REDO_BROADCAST, onRedoBroadcast);

    return () => {
      socket.off(SERVER_EVENTS.UNDO_STATE, onUndoState);
      socket.off(SERVER_EVENTS.UNDO_BROADCAST, onUndoBroadcast);
      socket.off(SERVER_EVENTS.REDO_BROADCAST, onRedoBroadcast);
    };
  }, [removeOperation, addOperation, clearPending]);

  // Keyboard shortcuts
  useEffect(() => {
    function onKeyDown(e) {
      const ctrl = e.ctrlKey || e.metaKey;
      if (!ctrl) return;

      if (e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        requestUndo();
      } else if (e.key === 'z' && e.shiftKey) {
        e.preventDefault();
        requestRedo();
      } else if (e.key === 'y') {
        e.preventDefault();
        requestRedo();
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [requestUndo, requestRedo]);

  return { canUndo, canRedo, requestUndo, requestRedo };
}
