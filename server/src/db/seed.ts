import { db } from './client';
import { maps } from './schema';
import { TileType } from '@tbs/shared';

async function seed() {
  console.log('Seeding database...');
  
  try {
    // Create sample maps
    const sampleMaps = [
      {
        name: 'Small Battlefield',
        description: 'A small map perfect for quick 2-player battles',
        width: 15,
        height: 15,
        maxPlayers: 2,
      },
      {
        name: 'Medium Arena',
        description: 'Medium-sized map for 2-4 players',
        width: 20,
        height: 20,
        maxPlayers: 4,
      },
      {
        name: 'Large Warzone',
        description: 'Large battlefield for epic 4-8 player wars',
        width: 30,
        height: 30,
        maxPlayers: 8,
      },
    ];
    
    for (const mapData of sampleMaps) {
      const tileData = generateTileData(mapData.width, mapData.height);
      const spawnPoints = generateSpawnPoints(mapData.width, mapData.height, mapData.maxPlayers);
      
      await db.insert(maps).values({
        ...mapData,
        tileData,
        spawnPoints,
      });
      
      console.log(`Created map: ${mapData.name}`);
    }
    
    console.log('Seeding completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  }
}

function generateTileData(width: number, height: number): any[][] {
  const tiles: any[][] = [];
  
  for (let y = 0; y < height; y++) {
    tiles[y] = [];
    for (let x = 0; x < width; x++) {
      const noise = Math.sin(x * 0.2) * Math.cos(y * 0.2) + Math.random() * 0.5;
      let type = TileType.GRASS;
      
      if (noise > 0.6) type = TileType.MOUNTAIN;
      else if (noise > 0.3) type = TileType.FOREST;
      else if (noise < -0.3) type = TileType.WATER;
      else if ((x % 7 === 3 || y % 7 === 3) && Math.random() > 0.7) type = TileType.ROAD;
      
      tiles[y][x] = {
        position: { x, y, z: 0 },
        type,
        isWalkable: type !== TileType.WATER && type !== TileType.MOUNTAIN,
        movementCost: type === TileType.FOREST ? 2 : 1,
        defenseBonus: type === TileType.FOREST ? 1 : type === TileType.MOUNTAIN ? 2 : 0,
      };
    }
  }
  
  return tiles;
}

function generateSpawnPoints(width: number, height: number, maxPlayers: number): any[] {
  const points: any[] = [];
  const margin = 3;
  
  // Corner spawns
  if (maxPlayers >= 2) {
    points.push({ x: margin, y: margin, z: 0 });
    points.push({ x: width - margin - 1, y: height - margin - 1, z: 0 });
  }
  if (maxPlayers >= 3) {
    points.push({ x: width - margin - 1, y: margin, z: 0 });
  }
  if (maxPlayers >= 4) {
    points.push({ x: margin, y: height - margin - 1, z: 0 });
  }
  
  // Edge spawns
  if (maxPlayers >= 5) {
    points.push({ x: Math.floor(width / 2), y: margin, z: 0 });
  }
  if (maxPlayers >= 6) {
    points.push({ x: Math.floor(width / 2), y: height - margin - 1, z: 0 });
  }
  if (maxPlayers >= 7) {
    points.push({ x: margin, y: Math.floor(height / 2), z: 0 });
  }
  if (maxPlayers >= 8) {
    points.push({ x: width - margin - 1, y: Math.floor(height / 2), z: 0 });
  }
  
  return points;
}

seed(); 