import { VIRTUAL_WIDTH, VIRTUAL_HEIGHT } from 'shared/constants.js';

/**
 * Compute the letterbox scale and offsets for a canvas element
 * so that the 1920×1080 virtual space fits inside the element
 * while maintaining aspect ratio.
 */
function getLetterbox(canvasEl) {
  const displayW = canvasEl.clientWidth;
  const displayH = canvasEl.clientHeight;
  const scale = Math.min(displayW / VIRTUAL_WIDTH, displayH / VIRTUAL_HEIGHT);
  const offsetX = (displayW - VIRTUAL_WIDTH  * scale) / 2;
  const offsetY = (displayH - VIRTUAL_HEIGHT * scale) / 2;
  return { scale, offsetX, offsetY };
}

/**
 * Convert screen (CSS pixel) coordinates to virtual 1920×1080 coordinates.
 */
export function toVirtual(screenX, screenY, canvasEl) {
  const { scale, offsetX, offsetY } = getLetterbox(canvasEl);
  return {
    x: (screenX - offsetX) / scale,
    y: (screenY - offsetY) / scale,
  };
}

/**
 * Convert virtual 1920×1080 coordinates to screen (CSS pixel) coordinates.
 */
export function toScreen(virtualX, virtualY, canvasEl) {
  const { scale, offsetX, offsetY } = getLetterbox(canvasEl);
  return {
    x: virtualX * scale + offsetX,
    y: virtualY * scale + offsetY,
  };
}
