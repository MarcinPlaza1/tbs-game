import { router, protectedProcedure } from '../trpc';
import { users } from '../../db/schema';
import { eq } from 'drizzle-orm';

export const userRouter = router({
  me: protectedProcedure.query(async ({ ctx }) => {
    const user = await ctx.db.query.users.findFirst({
      where: eq(users.id, ctx.user.id),
    });

    if (!user) {
      throw new Error('User not found');
    }

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      createdAt: user.createdAt,
    };
  }),

  profile: protectedProcedure.query(async ({ ctx }) => {
    // Get user stats (placeholder for now)
    return {
      user: {
        id: ctx.user.id,
        username: ctx.user.username,
        email: ctx.user.email,
      },
      stats: {
        gamesPlayed: 0,
        wins: 0,
        losses: 0,
        rating: 1500,
      },
    };
  }),
}); 