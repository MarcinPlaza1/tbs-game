import { z } from 'zod';
import { router, publicProcedure, protectedProcedure } from '../trpc';
import { maps } from '../../db/schema';
import { eq, desc } from 'drizzle-orm';
import { TileType } from '@tbs/shared';

const createMapSchema = z.object({
  name: z.string().min(3).max(100),
  description: z.string().optional(),
  width: z.number().min(10).max(50),
  height: z.number().min(10).max(50),
  maxPlayers: z.number().min(2).max(8),
});

export const mapRouter = router({
  list: publicProcedure.query(async ({ ctx }) => {
    return await ctx.db.query.maps.findMany({
      orderBy: (maps, { desc }) => [desc(maps.createdAt)],
    });
  }),

  get: publicProcedure
    .input(z.object({ mapId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return await ctx.db.query.maps.findFirst({
        where: eq(maps.id, input.mapId),
      });
    }),

  create: protectedProcedure
    .input(createMapSchema)
    .mutation(async ({ ctx, input }) => {
      // Generate basic map tile data
      const tileData: any[][] = [];
      const spawnPoints: any[] = [];

      for (let y = 0; y < input.height; y++) {
        tileData[y] = [];
        for (let x = 0; x < input.width; x++) {
          // Create varied terrain
          let type = TileType.GRASS;
          const rand = Math.random();
          
          if (rand < 0.1) type = TileType.FOREST;
          else if (rand < 0.15) type = TileType.MOUNTAIN;
          else if (rand < 0.2) type = TileType.WATER;
          
          tileData[y][x] = {
            position: { x, y, z: 0 },
            type,
            isWalkable: type !== TileType.WATER && type !== TileType.MOUNTAIN,
            movementCost: type === TileType.FOREST ? 2 : 1,
            defenseBonus: type === TileType.FOREST ? 1 : type === TileType.MOUNTAIN ? 2 : 0,
          };
        }
      }

      // Add spawn points in corners and edges
      const margin = 3;
      if (input.maxPlayers >= 2) {
        spawnPoints.push({ x: margin, y: margin, z: 0 });
        spawnPoints.push({ x: input.width - margin - 1, y: input.height - margin - 1, z: 0 });
      }
      if (input.maxPlayers >= 3) {
        spawnPoints.push({ x: input.width - margin - 1, y: margin, z: 0 });
      }
      if (input.maxPlayers >= 4) {
        spawnPoints.push({ x: margin, y: input.height - margin - 1, z: 0 });
      }
      if (input.maxPlayers >= 5) {
        spawnPoints.push({ x: Math.floor(input.width / 2), y: margin, z: 0 });
      }
      if (input.maxPlayers >= 6) {
        spawnPoints.push({ x: Math.floor(input.width / 2), y: input.height - margin - 1, z: 0 });
      }
      if (input.maxPlayers >= 7) {
        spawnPoints.push({ x: margin, y: Math.floor(input.height / 2), z: 0 });
      }
      if (input.maxPlayers >= 8) {
        spawnPoints.push({ x: input.width - margin - 1, y: Math.floor(input.height / 2), z: 0 });
      }

      const [map] = await ctx.db
        .insert(maps)
        .values({
          name: input.name,
          description: input.description || '',
          width: input.width,
          height: input.height,
          tileData,
          spawnPoints,
          maxPlayers: input.maxPlayers,
        })
        .returning();

      return map;
    }),
}); 