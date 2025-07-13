import { Schema, MapSchema, ArraySchema, type } from '@colyseus/schema';
import { GameStatus, GamePhase, UnitType } from '@tbs/shared';

export class Player extends Schema {
  @type('string') id: string = '';
  @type('string') username: string = '';
  @type('string') color: string = '';
  @type('boolean') isReady: boolean = false;
  @type('boolean') isActive: boolean = true;
  @type('number') gold: number = 1000;
  @type('number') mana: number = 100;
  @type('number') actionPoints: number = 3;
}

export class Position extends Schema {
  @type('number') x: number = 0;
  @type('number') y: number = 0;
  @type('number') z: number = 0;
}

export class Unit extends Schema {
  @type('string') id: string = '';
  @type('string') playerId: string = '';
  @type('string') type: UnitType = UnitType.WARRIOR;
  @type(Position) position: Position = new Position();
  @type('number') health: number = 100;
  @type('number') maxHealth: number = 100;
  @type('number') attack: number = 10;
  @type('number') defense: number = 5;
  @type('number') movement: number = 3;
  @type('number') range: number = 1;
  @type('boolean') hasMoved: boolean = false;
  @type('boolean') hasAttacked: boolean = false;
  @type('boolean') isAlive: boolean = true;
}

export class Tile extends Schema {
  @type(Position) position: Position = new Position();
  @type('string') type: string = 'grass';
  @type('boolean') isWalkable: boolean = true;
  @type('number') movementCost: number = 1;
  @type('number') defenseBonus: number = 0;
}

export class GameState extends Schema {
  @type('string') gameId: string = '';
  @type('string') status: GameStatus = GameStatus.WAITING;
  @type('string') phase: GamePhase = GamePhase.DEPLOYMENT;
  @type('number') currentPlayerIndex: number = 0;
  @type('number') turnNumber: number = 1;
  @type({ map: Player }) players = new MapSchema<Player>();
  @type({ map: Unit }) units = new MapSchema<Unit>();
  @type('number') mapWidth: number = 20;
  @type('number') mapHeight: number = 20;
  @type('string') winnerId: string = '';
  @type('number') turnTimeRemaining: number = 0;
} 