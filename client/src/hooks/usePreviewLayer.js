import { useRef, useState, useEffect } from 'react';
import { getSocket } from '../services/socket.js';
import { SERVER_EVENTS } from 'shared/constants.js';

/**
 * Manages the in-progress stroke preview overlay.
 *
 * Uses a stable Map (via useRef) as the backing store and a counter state
 * to trigger re-renders when the map changes.
 */
export function usePreviewLayer() {
  const previewsRef = useRef(new Map());
  const [, setVersion] = useState(0);

  function bump() {
    setVersion((v) => v + 1);
  }

  function setPreview(preview) {
    previewsRef.current.set(preview.operationId, preview);
    bump();
  }

  function removePreview(operationId) {
    if (previewsRef.current.has(operationId)) {
      previewsRef.current.delete(operationId);
      bump();
    }
  }

  function clearAllPreviews() {
    if (previewsRef.current.size > 0) {
      previewsRef.current.clear();
      bump();
    }
  }

  // Socket subscriptions for remote preview events (US2)
  useEffect(() => {
    const socket = getSocket();

    function onPreviewBroadcast(payload) {
      previewsRef.current.set(payload.operationId, payload);
      bump();
    }

    function onCancelBroadcast(payload) {
      if (previewsRef.current.has(payload.operationId)) {
        previewsRef.current.delete(payload.operationId);
        bump();
      }
    }

    function onUserLeft(payload) {
      let changed = false;
      for (const [opId, preview] of previewsRef.current) {
        if (preview.userId === payload.userId) {
          previewsRef.current.delete(opId);
          changed = true;
        }
      }
      if (changed) bump();
    }

    function onDrawBroadcast(payload) {
      // FR-011: remove preview when the committed draw:broadcast arrives for the same operationId
      if (previewsRef.current.has(payload.operationId)) {
        previewsRef.current.delete(payload.operationId);
        bump();
      }
    }

    socket.on(SERVER_EVENTS.STROKE_PREVIEW_BROADCAST, onPreviewBroadcast);
    socket.on(SERVER_EVENTS.STROKE_CANCEL_BROADCAST, onCancelBroadcast);
    socket.on(SERVER_EVENTS.USER_LEFT, onUserLeft);
    socket.on(SERVER_EVENTS.DRAW_BROADCAST, onDrawBroadcast);

    return () => {
      socket.off(SERVER_EVENTS.STROKE_PREVIEW_BROADCAST, onPreviewBroadcast);
      socket.off(SERVER_EVENTS.STROKE_CANCEL_BROADCAST, onCancelBroadcast);
      socket.off(SERVER_EVENTS.USER_LEFT, onUserLeft);
      socket.off(SERVER_EVENTS.DRAW_BROADCAST, onDrawBroadcast);
    };
  }, []);

  return {
    previews: previewsRef.current,
    setPreview,
    removePreview,
    clearAllPreviews,
  };
}
