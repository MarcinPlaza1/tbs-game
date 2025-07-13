import { Position } from './unit';

export enum TileType {
  GRASS = 'grass',
  FOREST = 'forest',
  MOUNTAIN = 'mountain',
  WATER = 'water',
  ROAD = 'road',
  CASTLE = 'castle'
}

export interface Tile {
  position: Position;
  type: TileType;
  isWalkable: boolean;
  movementCost: number;
  defenseBonus: number;
}

export interface GameMap {
  id: string;
  name: string;
  width: number;
  height: number;
  tiles: Tile[][];
  spawnPoints: Position[];
}

export interface MapMetadata {
  id: string;
  name: string;
  description: string;
  thumbnail: string;
  playerCount: number;
  size: 'small' | 'medium' | 'large';
} 