import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { games, gamePlayers } from '../../db/schema';
import { eq, desc } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';

const createGameSchema = z.object({
  mapId: z.string().uuid(),
  settings: z.object({
    maxPlayers: z.number().min(2).max(8),
    turnTimeLimit: z.number().optional(),
    isPrivate: z.boolean(),
  }),
});

const joinGameSchema = z.object({
  gameId: z.string().uuid(),
});

export const gameRouter = router({
  create: protectedProcedure
    .input(createGameSchema)
    .mutation(async ({ ctx, input }) => {
      const [game] = await ctx.db
        .insert(games)
        .values({
          mapId: input.mapId,
          settings: input.settings,
        })
        .returning();

      // Add creator as first player
      await ctx.db.insert(gamePlayers).values({
        gameId: game.id,
        userId: ctx.user.id,
        playerIndex: 0,
        color: '#FF0000', // Red for first player
      });

      return game;
    }),

  join: protectedProcedure
    .input(joinGameSchema)
    .mutation(async ({ ctx, input }) => {
      // Get game and check if it exists
      const game = await ctx.db.query.games.findFirst({
        where: eq(games.id, input.gameId),
        with: {
          players: true,
        },
      });

      if (!game) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Game not found',
        });
      }

      // Check if game is full
      const settings = game.settings as any;
      if (game.players.length >= settings.maxPlayers) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Game is full',
        });
      }

      // Check if player already in game
      const existingPlayer = game.players.find(p => p.userId === ctx.user.id);
      if (existingPlayer) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Already in this game',
        });
      }

      // Add player to game
      const playerColors = ['#FF0000', '#0000FF', '#00FF00', '#FFFF00', '#FF00FF', '#00FFFF', '#FFA500', '#800080'];
      const playerIndex = game.players.length;

      await ctx.db.insert(gamePlayers).values({
        gameId: game.id,
        userId: ctx.user.id,
        playerIndex,
        color: playerColors[playerIndex],
      });

      return { success: true };
    }),

  list: protectedProcedure.query(async ({ ctx }) => {
    const gamesList = await ctx.db.query.games.findMany({
      where: eq(games.status, 'waiting'),
      with: {
        players: {
          with: {
            user: true,
          },
        },
        map: true,
      },
      orderBy: (games, { desc }) => [desc(games.createdAt)],
    });

    return gamesList;
  }),

  get: protectedProcedure
    .input(z.object({ gameId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const game = await ctx.db.query.games.findFirst({
        where: eq(games.id, input.gameId),
        with: {
          players: {
            with: {
              user: true,
            },
          },
          map: true,
        },
      });

      if (!game) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Game not found',
        });
      }

      // Check if user is a player in this game
      const isPlayer = game.players.some(player => player.userId === ctx.user.id);
      if (!isPlayer) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You are not authorized to access this game',
        });
      }

      return game;
    }),
}); 