import { Server } from 'colyseus';
import { monitor } from '@colyseus/monitor';
import { createServer } from 'http';
import express from 'express';
import cors from 'cors';
import { GameRoom } from './rooms/GameRoom';

const port = Number(process.env.GAME_SERVER_PORT) || 2567;
const app = express();

app.use(cors());
app.use(express.json());

const gameServer = new Server({
  server: createServer(app),
});

// Register game room
gameServer.define('game_room', GameRoom);

// Register colyseus monitor
app.use('/colyseus', monitor());

gameServer.listen(port);
console.log(`🎮 Game server running on ws://localhost:${port}`); 