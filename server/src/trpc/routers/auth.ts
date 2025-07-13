import { z } from 'zod';
import bcrypt from 'bcrypt';
import jwt, { SignOptions } from 'jsonwebtoken';
import { TRPCError } from '@trpc/server';
import { router, publicProcedure } from '../trpc';
import { users } from '../../db/schema';
import { eq } from 'drizzle-orm';
import { env } from '../../config/env';

const registerSchema = z.object({
  username: z.string().min(3).max(50),
  email: z.string().email(),
  password: z.string().min(6),
});

const loginSchema = z.object({
  username: z.string(),
  password: z.string(),
});

export const authRouter = router({
  register: publicProcedure
    .input(registerSchema)
    .mutation(async ({ ctx, input }) => {
      const { username, email, password } = input;

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
      const [newUser] = await ctx.db
        .insert(users)
        .values({
          username,
          email,
          passwordHash,
        })
        .returning();

      // Generate token
      const token = jwt.sign(
        { userId: newUser.id },
        env.JWT_SECRET,
        { expiresIn: '7d' }
      );

      return {
        user: {
          id: newUser.id,
          username: newUser.username,
          email: newUser.email,
        },
        token,
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

      // Generate token
      const token = jwt.sign(
        { userId: user.id },
        env.JWT_SECRET,
        { expiresIn: '7d' }
      );

      return {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
        },
        token,
      };
    }),
}); 