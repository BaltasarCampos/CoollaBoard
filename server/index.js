import { createServer } from 'http';
import { Server } from 'socket.io';
import { registerHandlers } from './src/handlers/eventHandlers.js';
import logger from './src/utils/logger.js';

const PORT = process.env.PORT || 3001;

const httpServer = createServer();

const io = new Server(httpServer, {
  cors: {
    origin: 'http://localhost:5173',
    methods: ['GET', 'POST'],
  },
});

registerHandlers(io);

httpServer.listen(PORT, () => {
  logger.info({ event: 'server:start', port: PORT });
});
