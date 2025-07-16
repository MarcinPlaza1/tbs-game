import { z } from 'zod';
import bcrypt from 'bcrypt';
import jwt, { SignOptions } from 'jsonwebtoken';
import { TRPCError } from '@trpc/server';
import { router, publicProcedure } from '../trpc';
import { users, refreshTokens, passwordResetTokens } from '../../db/schema';
import { eq, lt } from 'drizzle-orm';
import { env } from '../../config/env';
import { randomBytes } from 'crypto';
import { checkRateLimit } from '../middleware/simpleRateLimit';

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

const hashRefreshToken = async (token: string): Promise<string> => {
  return await bcrypt.hash(token, 10);
};

const verifyRefreshToken = async (token: string, hash: string): Promise<boolean> => {
  return await bcrypt.compare(token, hash);
};

const getClientIP = (req: any): string => {
  return req.headers['x-forwarded-for'] || 
         req.headers['x-real-ip'] || 
         req.connection?.remoteAddress || 
         req.socket?.remoteAddress || 
         req.ip || 
         'unknown';
};

const getClientUserAgent = (req: any): string => {
  return req.headers['user-agent'] || 'unknown';
};

const generateTokenPair = async (userId: string, username: string, ipAddress?: string, userAgent?: string) => {
  const accessToken = jwt.sign(
    { userId, username },
    env.JWT_SECRET,
    { expiresIn: '15m' } // Short-lived access token
  );
  
  const refreshToken = generateRefreshToken();
  const refreshTokenHash = await hashRefreshToken(refreshToken);
  const refreshTokenExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
  
  return { accessToken, refreshToken, refreshTokenHash, refreshTokenExpiresAt, ipAddress, userAgent };
};

export const authRouter = router({
  register: publicProcedure
    .input(registerSchema)
    .mutation(async ({ ctx, input }) => {
      const { username, email, password } = input;

      // Rate limiting
      const identifier = ctx.user?.id || 'anonymous';
      checkRateLimit('auth.register', identifier);

      // Check if user already exists
      const existingUser = await ctx.db.query.users.findFirst({
        where: eq(users.username, username),
      });

      if (existingUser) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Username already taken',
        });
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, 10);

      // Create user
      // Generate email verification token
      const emailVerificationToken = randomBytes(32).toString('hex');
      const emailVerificationTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      const [newUser] = await ctx.db
        .insert(users)
        .values({
          username,
          email,
          passwordHash,
          emailVerificationToken,
          emailVerificationTokenExpiry,
        })
        .returning();

      // Generate token pair
      const ipAddress = getClientIP(ctx.req);
      const userAgent = getClientUserAgent(ctx.req);
      const { accessToken, refreshToken, refreshTokenHash, refreshTokenExpiresAt } = await generateTokenPair(newUser.id, newUser.username, ipAddress, userAgent);

      // Store refresh token in database
      await ctx.db.insert(refreshTokens).values({
        userId: newUser.id,
        tokenHash: refreshTokenHash,
        expiresAt: refreshTokenExpiresAt,
        ipAddress,
        userAgent,
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

      // Rate limiting
      const identifier = ctx.user?.id || username;
      checkRateLimit('auth.login', identifier);

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
      const ipAddress = getClientIP(ctx.req);
      const userAgent = getClientUserAgent(ctx.req);
      const { accessToken, refreshToken, refreshTokenHash, refreshTokenExpiresAt } = await generateTokenPair(user.id, user.username, ipAddress, userAgent);

      // Store refresh token in database
      await ctx.db.insert(refreshTokens).values({
        userId: user.id,
        tokenHash: refreshTokenHash,
        expiresAt: refreshTokenExpiresAt,
        ipAddress,
        userAgent,
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

      // Rate limiting
      const identifier = ctx.user?.id || 'anonymous';
      checkRateLimit('auth.refreshToken', identifier);

      // Find all non-revoked refresh tokens for potential matching
      const tokenRecords = await ctx.db.query.refreshTokens.findMany({
        where: eq(refreshTokens.isRevoked, false),
        with: {
          user: true,
        },
      });

      // Find matching token by comparing hashes
      let matchingTokenRecord = null;
      for (const record of tokenRecords) {
        if (await verifyRefreshToken(refreshToken, record.tokenHash)) {
          matchingTokenRecord = record;
          break;
        }
      }

      if (!matchingTokenRecord) {
        // Check if token was already used (revoked) - potential security breach
        const revokedTokenRecords = await ctx.db.query.refreshTokens.findMany({
          where: eq(refreshTokens.isRevoked, true),
          with: {
            user: true,
          },
        });

        for (const record of revokedTokenRecords) {
          if (await verifyRefreshToken(refreshToken, record.tokenHash)) {
            // Token reuse detected - revoke all tokens for this user
            console.log('🚨 Token reuse detected for user:', record.userId);
            await ctx.db.update(refreshTokens)
              .set({ isRevoked: true })
              .where(eq(refreshTokens.userId, record.userId));
            
            throw new TRPCError({
              code: 'UNAUTHORIZED',
              message: 'Token reuse detected. All sessions have been terminated.',
            });
          }
        }

        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Invalid refresh token',
        });
      }

      // Check if token is expired
      if (matchingTokenRecord.expiresAt < new Date()) {
        // Delete expired token
        await ctx.db.update(refreshTokens)
          .set({ isRevoked: true })
          .where(eq(refreshTokens.id, matchingTokenRecord.id));
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Refresh token expired',
        });
      }

      // Generate new token pair
      const ipAddress = getClientIP(ctx.req);
      const userAgent = getClientUserAgent(ctx.req);
      const { accessToken, refreshToken: newRefreshToken, refreshTokenHash, refreshTokenExpiresAt } = await generateTokenPair(matchingTokenRecord.userId, matchingTokenRecord.user.username, ipAddress, userAgent);

      // Revoke old refresh token
      await ctx.db.update(refreshTokens)
        .set({ isRevoked: true })
        .where(eq(refreshTokens.id, matchingTokenRecord.id));

      // Insert new refresh token
      await ctx.db.insert(refreshTokens).values({
        userId: matchingTokenRecord.userId,
        tokenHash: refreshTokenHash,
        expiresAt: refreshTokenExpiresAt,
        ipAddress,
        userAgent,
      });

      return {
        user: {
          id: matchingTokenRecord.user.id,
          username: matchingTokenRecord.user.username,
          email: matchingTokenRecord.user.email,
        },
        token: accessToken,
        refreshToken: newRefreshToken,
      };
    }),

  logout: publicProcedure
    .input(refreshTokenSchema)
    .mutation(async ({ ctx, input }) => {
      const { refreshToken } = input;

      // Find and revoke refresh token
      const tokenRecords = await ctx.db.query.refreshTokens.findMany({
        where: eq(refreshTokens.isRevoked, false),
      });

      for (const record of tokenRecords) {
        if (await verifyRefreshToken(refreshToken, record.tokenHash)) {
          await ctx.db.update(refreshTokens)
            .set({ isRevoked: true })
            .where(eq(refreshTokens.id, record.id));
          break;
        }
      }

      return { success: true };
    }),

  requestPasswordReset: publicProcedure
    .input(passwordResetRequestSchema)
    .mutation(async ({ ctx, input }) => {
      const { email } = input;

      // Rate limiting
      const identifier = ctx.user?.id || email;
      checkRateLimit('auth.passwordResetRequest', identifier);

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
      // For now, just log the token (in production, send email)
      console.log(`Password reset token for ${email}: ${resetToken}`);

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

      // Revoke all refresh tokens for this user (force re-login)
      await ctx.db.update(refreshTokens)
        .set({ isRevoked: true })
        .where(eq(refreshTokens.userId, resetToken.userId));

      return { success: true };
    }),

  // Revoke all sessions for current user
  revokeAllSessions: publicProcedure
    .mutation(async ({ ctx }) => {
      if (!ctx.user) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Not authenticated',
        });
      }

      // Revoke all refresh tokens for this user
      await ctx.db.update(refreshTokens)
        .set({ isRevoked: true })
        .where(eq(refreshTokens.userId, ctx.user.id));

      return { success: true };
    }),

  // Email verification
  verifyEmail: publicProcedure
    .input(z.object({ token: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { token } = input;

      // Find user with this verification token
      const user = await ctx.db.query.users.findFirst({
        where: eq(users.emailVerificationToken, token),
      });

      if (!user) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Invalid or expired verification token',
        });
      }

      // Check if token is expired
      if (user.emailVerificationTokenExpiry && user.emailVerificationTokenExpiry < new Date()) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Verification token has expired',
        });
      }

      // Update user as verified
      await ctx.db
        .update(users)
        .set({
          emailVerified: true,
          emailVerificationToken: null,
          emailVerificationTokenExpiry: null,
        })
        .where(eq(users.id, user.id));

      return {
        success: true,
        message: 'Email verified successfully',
      };
    }),

  // Resend verification email
  resendVerification: publicProcedure
    .input(z.object({ email: z.string().email() }))
    .mutation(async ({ ctx, input }) => {
      const { email } = input;

      // Find user by email
      const user = await ctx.db.query.users.findFirst({
        where: eq(users.email, email),
      });

      if (!user) {
        // Don't reveal if email exists or not for security
        return {
          success: true,
          message: 'If the email exists, a verification email has been sent',
        };
      }

      // Check if already verified
      if (user.emailVerified) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Email is already verified',
        });
      }

      // Generate new verification token
      const verificationToken = randomBytes(32).toString('hex');
      const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      // Update user with new token
      await ctx.db
        .update(users)
        .set({
          emailVerificationToken: verificationToken,
          emailVerificationTokenExpiry: tokenExpiry,
        })
        .where(eq(users.id, user.id));

      // In production, send actual email here
      // For now, just return success
      return {
        success: true,
        message: 'Verification email sent',
        // In development, you might want to return the token for testing
        // token: verificationToken,
      };
    }),

  // CSRF tokens removed - using Authorization header + HttpOnly cookies provides sufficient protection
}); 