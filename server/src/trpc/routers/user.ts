import { z } from 'zod';
import bcrypt from 'bcrypt';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../trpc';
import { users } from '../../db/schema';
import { eq } from 'drizzle-orm';

const changeEmailSchema = z.object({
  newEmail: z.string().email(),
  currentPassword: z.string(),
});

const changePasswordSchema = z.object({
  currentPassword: z.string(),
  newPassword: z.string().min(6),
});

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

  changeEmail: protectedProcedure
    .input(changeEmailSchema)
    .mutation(async ({ ctx, input }) => {
      const { newEmail, currentPassword } = input;

      // Get current user with password hash
      const currentUser = await ctx.db.query.users.findFirst({
        where: eq(users.id, ctx.user.id),
      });

      if (!currentUser) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'User not found',
        });
      }

      // Verify current password
      const isValidPassword = await bcrypt.compare(currentPassword, currentUser.passwordHash);
      if (!isValidPassword) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Invalid current password',
        });
      }

      // Check if new email is already taken
      const existingUser = await ctx.db.query.users.findFirst({
        where: eq(users.email, newEmail),
      });

      if (existingUser && existingUser.id !== ctx.user.id) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Email already taken',
        });
      }

      // Update email
      await ctx.db.update(users)
        .set({ 
          email: newEmail,
          updatedAt: new Date(),
        })
        .where(eq(users.id, ctx.user.id));

      return { success: true };
    }),

  changePassword: protectedProcedure
    .input(changePasswordSchema)
    .mutation(async ({ ctx, input }) => {
      const { currentPassword, newPassword } = input;

      // Get current user with password hash
      const currentUser = await ctx.db.query.users.findFirst({
        where: eq(users.id, ctx.user.id),
      });

      if (!currentUser) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'User not found',
        });
      }

      // Verify current password
      const isValidPassword = await bcrypt.compare(currentPassword, currentUser.passwordHash);
      if (!isValidPassword) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Invalid current password',
        });
      }

      // Hash new password
      const passwordHash = await bcrypt.hash(newPassword, 10);

      // Update password
      await ctx.db.update(users)
        .set({ 
          passwordHash,
          updatedAt: new Date(),
        })
        .where(eq(users.id, ctx.user.id));

      return { success: true };
    }),
}); 