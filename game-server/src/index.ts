import { Server } from 'colyseus';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { monitor } from '@colyseus/monitor';
import { createServer } from 'http';
import express from 'express';
import cors from 'cors';
import { GameRoom } from './rooms/GameRoom';
import { env } from './config/env';

const port = env.GAME_SERVER_PORT;
const app = express();

app.use(cors());
app.use(express.json());

const server = createServer(app);

const gameServer = new Server({
  transport: new WebSocketTransport({
    server: server,
    pingInterval: 3000,
    pingMaxRetries: 3,
  }),
  // Enable reconnection capability
  gracefullyShutdown: false,
});

// Register game room
gameServer.define('game_room', GameRoom);

// Register colyseus monitor
app.use('/colyseus', monitor());

gameServer.listen(port);
console.log(`🎮 Game server running on ws://localhost:${port}`); 