export enum UnitType {
  WARRIOR = 'warrior',
  ARCHER = 'archer',
  MAGE = 'mage',
  CAVALRY = 'cavalry',
  SIEGE = 'siege'
}

export interface Position {
  x: number;
  y: number;
  z: number;
}

export interface UnitStats {
  health: number;
  maxHealth: number;
  attack: number;
  defense: number;
  movement: number;
  range: number;
}

export interface Unit {
  id: string;
  playerId: string;
  type: UnitType;
  position: Position;
  stats: UnitStats;
  hasMoved: boolean;
  hasAttacked: boolean;
  isAlive: boolean;
}

export interface UnitAction {
  unitId: string;
  type: 'move' | 'attack' | 'ability';
  targetPosition?: Position;
  targetUnitId?: string;
  abilityId?: string;
} 