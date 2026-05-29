// Event names — client → server
export const EVENTS = {
  ROOM_CREATE:    'room:create',
  ROOM_JOIN:      'room:join',
  ROOM_LEAVE:     'room:leave',
  DRAW_STROKE:    'draw:stroke',
  CANVAS_CLEAR:   'canvas:clear',
  STROKE_PREVIEW: 'stroke:preview',
  STROKE_CANCEL:  'stroke:cancel',
  UNDO_REQUEST:   'undo:request',
  REDO_REQUEST:   'redo:request',
};

// Event names — server → client
export const SERVER_EVENTS = {
  ROOM_CREATED:              'room:created',
  ROOM_STATE:                'room:state',
  DRAW_BROADCAST:            'draw:broadcast',
  CANVAS_CLEARED:            'canvas:cleared',
  ROOM_ERROR:                'room:error',
  STROKE_PREVIEW_BROADCAST:  'stroke:preview:broadcast',
  STROKE_CANCEL_BROADCAST:   'stroke:cancel:broadcast',
  USER_LEFT:                 'user:left',
  UNDO_BROADCAST:            'undo:broadcast',
  REDO_BROADCAST:            'redo:broadcast',
  UNDO_STATE:                'undo:state',
  PARTICIPANTS_UPDATED:      'participants:updated',
};

// Canvas virtual coordinate space
export const VIRTUAL_WIDTH  = 1920;
export const VIRTUAL_HEIGHT = 1080;

// Tool defaults
export const ERASER_RADIUS      = 20;         // virtual units
export const DEFAULT_STROKE_COLOR = '#111111';
export const DEFAULT_BRUSH_WIDTH  = 4;

// Color palette and brush size presets
export const STROKE_PALETTE = [
  '#111111',
  '#ffffff',
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#3b82f6',
  '#a855f7',
];

export const BRUSH_PRESETS = [
  { label: 'S', value: 2 },
  { label: 'M', value: 4 },
  { label: 'L', value: 8 },
];

// Room
export const ROOM_ID_LENGTH       = 6;
export const ROOM_ID_ALPHABET     = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
export const ROOM_GRACE_PERIOD_MS = 45_000; // 45 seconds

// Operation types
export const OP_TYPE = {
  DRAW:  'DRAW',
  ERASE: 'ERASE',
  CLEAR: 'CLEAR',
};

// Named identifiers for drawing tools
export const TOOL_NAMES = {
  PEN:    'pen',
  ERASER: 'eraser',
};

// Display labels for WebSocket connection states
export const CONNECTION_STATUS = {
  CONNECTED:    'Connected',
  RECONNECTING: 'Reconnecting',
  DISCONNECTED: 'Disconnected',
};

// Machine-readable error code strings used in socket acknowledgement payloads
export const ERROR_CODES = {
  ROOM_NOT_FOUND: 'ROOM_NOT_FOUND',
  SERVER_ERROR:   'SERVER_ERROR',
};

// Undo / redo history configuration
export const UNDO_HISTORY_DEPTH      = 20;
export const UNDO_CONFIRM_TIMEOUT_MS = 5000;
