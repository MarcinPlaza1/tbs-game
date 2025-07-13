export interface Unit {
  id: string;
  playerId: string;
  type: string;
  position: { x: number; y: number; z: number };
  health: number;
  maxHealth: number;
  attack: number;
  defense: number;
  movement: number;
  range: number;
  hasMoved?: boolean;
  hasAttacked?: boolean;
  isAlive?: boolean;
}

export interface GameState {
  id: string;
  turnNumber: number;
  currentPlayerIndex: number;
  mapWidth: number;
  mapHeight: number;
  phase: string;
  status: string;
  units?: Map<string, any>;
  players?: Record<string, any>;
}