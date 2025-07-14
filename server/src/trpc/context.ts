import { type CreateHTTPContextOptions } from '@trpc/server/adapters/standalone';
import jwt from 'jsonwebtoken';
import { db } from '../db/client';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';
import { env } from '../config/env';

export interface User {
  id: string;
  username: string;
  email: string;
}

export interface Context {
  db: typeof db;
  user?: User;
  req: CreateHTTPContextOptions['req'];
}

export async function createContext({ req }: CreateHTTPContextOptions): Promise<Context> {
  let user: User | undefined;

  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (token) {
      const decoded = jwt.verify(token, env.JWT_SECRET) as any;
      
      // Validate token structure
      if (!decoded || typeof decoded !== 'object' || !decoded.userId || typeof decoded.userId !== 'string') {
        throw new Error('Invalid token structure');
      }
      
      const dbUser = await db.query.users.findFirst({
        where: eq(users.id, decoded.userId),
      });
      
      if (dbUser) {
        user = {
          id: dbUser.id,
          username: dbUser.username,
          email: dbUser.email,
        };
      }
    }
  } catch (error) {
    // Invalid token, continue without user
    // In production, consider logging authentication failures for security monitoring
  }

  return {
    db,
    user,
    req,
  };
} 