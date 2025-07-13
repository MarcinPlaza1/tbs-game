import { z } from 'zod';
import bcrypt from 'bcrypt';
import jwt, { SignOptions } from 'jsonwebtoken';
import { TRPCError } from '@trpc/server';
import { router, publicProcedure } from '../trpc';
import { users, refreshTokens, passwordResetTokens } from '../../db/schema';
import { eq, lt } from 'drizzle-orm';
import { env } from '../../config/env';
import { randomBytes } from 'crypto';

const registerSchema = z.object({
  username: z.string().min(3).max(50),
  email: z.string().email(),
  password: z.string().min(6),
});

const loginSchema = z.object({
  username: z.string(),
  password: z.string(),
});

const refreshTokenSchema = z.object({
  refreshToken: z.string(),
});

const passwordResetRequestSchema = z.object({
  email: z.string().email(),
});

const passwordResetSchema = z.object({
  token: z.string(),
  newPassword: z.string().min(6),
});

// Utility functions
const generateRefreshToken = (): string => {
  return randomBytes(32).toString('hex');
};

const generateTokenPair = (userId: string) => {
  const accessToken = jwt.sign(
    { userId },
    env.JWT_SECRET,
    { expiresIn: '15m' } // Short-lived access token
  );
  
  const refreshToken = generateRefreshToken();
  const refreshTokenExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
  
  return { accessToken, refreshToken, refreshTokenExpiresAt };
};

export const authRouter = router({
  register: publicProcedure
    .input(registerSchema)
    .mutation(async ({ ctx, input }) => {
      const { username, email, password } = input;

      // Check if user already exists by username
      const existingUserByUsername = await ctx.db.query.users.findFirst({
        where: eq(users.username, username),
      });

      if (existingUserByUsername) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Username already taken',
        });
      }

      // Check if user already exists by email
      const existingUserByEmail = await ctx.db.query.users.findFirst({
        where: eq(users.email, email),
      });

      if (existingUserByEmail) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Email already taken',
        });
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, 10);

      // Create user
      const [newUser] = await ctx.db
        .insert(users)
        .values({
          username,
          email,
          passwordHash,
        })
        .returning();

      // Generate token pair
      const { accessToken, refreshToken, refreshTokenExpiresAt } = generateTokenPair(newUser.id);

      // Store refresh token in database
      await ctx.db.insert(refreshTokens).values({
        userId: newUser.id,
        token: refreshToken,
        expiresAt: refreshTokenExpiresAt,
      });

      return {
        user: {
          id: newUser.id,
          username: newUser.username,
          email: newUser.email,
        },
        token: accessToken,
        refreshToken,
      };
    }),

  login: publicProcedure
    .input(loginSchema)
    .mutation(async ({ ctx, input }) => {
      const { username, password } = input;

      // Find user
      const user = await ctx.db.query.users.findFirst({
        where: eq(users.username, username),
      });

      if (!user) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Invalid credentials',
        });
      }

      // Check password
      const isValidPassword = await bcrypt.compare(password, user.passwordHash);

      if (!isValidPassword) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Invalid credentials',
        });
      }

      // Generate token pair
      const { accessToken, refreshToken, refreshTokenExpiresAt } = generateTokenPair(user.id);

      // Store refresh token in database
      await ctx.db.insert(refreshTokens).values({
        userId: user.id,
        token: refreshToken,
        expiresAt: refreshTokenExpiresAt,
      });

      return {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
        },
        token: accessToken,
        refreshToken,
      };
    }),

  refresh: publicProcedure
    .input(refreshTokenSchema)
    .mutation(async ({ ctx, input }) => {
      const { refreshToken } = input;

      // Find and validate refresh token
      const tokenRecord = await ctx.db.query.refreshTokens.findFirst({
        where: eq(refreshTokens.token, refreshToken),
        with: {
          user: true,
        },
      });

      if (!tokenRecord) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Invalid refresh token',
        });
      }

      // Check if token is expired
      if (tokenRecord.expiresAt < new Date()) {
        // Delete expired token
        await ctx.db.delete(refreshTokens).where(eq(refreshTokens.token, refreshToken));
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Refresh token expired',
        });
      }

      // Generate new token pair
      const { accessToken, refreshToken: newRefreshToken, refreshTokenExpiresAt } = generateTokenPair(tokenRecord.userId);

      // Replace old refresh token with new one
      await ctx.db.delete(refreshTokens).where(eq(refreshTokens.token, refreshToken));
      await ctx.db.insert(refreshTokens).values({
        userId: tokenRecord.userId,
        token: newRefreshToken,
        expiresAt: refreshTokenExpiresAt,
      });

      return {
        user: {
          id: tokenRecord.user.id,
          username: tokenRecord.user.username,
          email: tokenRecord.user.email,
        },
        token: accessToken,
        refreshToken: newRefreshToken,
      };
    }),

  logout: publicProcedure
    .input(refreshTokenSchema)
    .mutation(async ({ ctx, input }) => {
      const { refreshToken } = input;

      // Delete refresh token from database
      await ctx.db.delete(refreshTokens).where(eq(refreshTokens.token, refreshToken));

      return { success: true };
    }),

  requestPasswordReset: publicProcedure
    .input(passwordResetRequestSchema)
    .mutation(async ({ ctx, input }) => {
      const { email } = input;

      // Find user by email
      const user = await ctx.db.query.users.findFirst({
        where: eq(users.email, email),
      });

      if (!user) {
        // Don't reveal if email exists or not for security
        return { success: true };
      }

      // Generate reset token
      const resetToken = randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      // Delete any existing reset tokens for this user
      await ctx.db.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, user.id));

      // Create new reset token
      await ctx.db.insert(passwordResetTokens).values({
        userId: user.id,
        token: resetToken,
        expiresAt,
      });

      // TODO: Send email with reset link
      // In production, implement proper email sending instead of logging
      // console.log(`Password reset token for ${email}: ${resetToken}`);

      return { success: true };
    }),

  resetPassword: publicProcedure
    .input(passwordResetSchema)
    .mutation(async ({ ctx, input }) => {
      const { token, newPassword } = input;

      // Find valid reset token
      const resetToken = await ctx.db.query.passwordResetTokens.findFirst({
        where: eq(passwordResetTokens.token, token),
        with: {
          user: true,
        },
      });

      if (!resetToken) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Invalid or expired reset token',
        });
      }

      // Check if token is expired
      if (resetToken.expiresAt < new Date()) {
        // Delete expired token
        await ctx.db.delete(passwordResetTokens).where(eq(passwordResetTokens.token, token));
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Reset token expired',
        });
      }

      // Hash new password
      const passwordHash = await bcrypt.hash(newPassword, 10);

      // Update user password
      await ctx.db.update(users)
        .set({ passwordHash })
        .where(eq(users.id, resetToken.userId));

      // Delete used reset token
      await ctx.db.delete(passwordResetTokens).where(eq(passwordResetTokens.token, token));

      // Delete all refresh tokens for this user (force re-login)
      await ctx.db.delete(refreshTokens).where(eq(refreshTokens.userId, resetToken.userId));

      return { success: true };
    }),
}); 