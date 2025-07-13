import { config } from 'dotenv';
import { z } from 'zod';

config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).default('3000'),
  DATABASE_URL: z.string(),
  JWT_SECRET: z.string(),
  JWT_EXPIRES_IN: z.string().default('7d'),
  CLIENT_URL: z.string().optional(),
  COLYSEUS_URL: z.string().default('ws://localhost:2567'),
});

export const env = envSchema.parse(process.env); 