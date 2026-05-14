// Event names — client → server
export const EVENTS = {
  ROOM_CREATE:  'room:create',
  ROOM_JOIN:    'room:join',
  DRAW_STROKE:  'draw:stroke',
  CANVAS_CLEAR: 'canvas:clear',
};

// Event names — server → client
export const SERVER_EVENTS = {
  ROOM_CREATED:   'room:created',
  ROOM_STATE:     'room:state',
  DRAW_BROADCAST: 'draw:broadcast',
  CANVAS_CLEARED: 'canvas:cleared',
  ROOM_ERROR:     'room:error',
};

// Canvas virtual coordinate space
export const VIRTUAL_WIDTH  = 1920;
export const VIRTUAL_HEIGHT = 1080;

// Tool defaults
export const BRUSH_WIDTH   = 4;          // virtual units
export const ERASER_RADIUS = 20;         // virtual units
export const STROKE_COLOR  = '#000000';

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
