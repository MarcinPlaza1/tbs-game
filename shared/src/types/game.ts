export enum GameStatus {
  WAITING = 'waiting',
  IN_PROGRESS = 'in_progress',
  FINISHED = 'finished'
}

export enum GamePhase {
  DEPLOYMENT = 'deployment',
  BATTLE = 'battle'
}

export interface GameState {
  id: string;
  status: GameStatus;
  phase: GamePhase;
  currentPlayerIndex: number;
  turnNumber: number;
  players: string[]; // player IDs
  winner?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface GameSettings {
  mapId: string;
  maxPlayers: number;
  turnTimeLimit?: number; // seconds
  isPrivate: boolean;
} 