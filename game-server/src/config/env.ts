import { config } from 'dotenv';
import { z } from 'zod';

config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  GAME_SERVER_PORT: z.string().transform(Number).default('2567'),
  JWT_SECRET: z.string(),
  DATABASE_URL: z.string(),
});

export const env = envSchema.parse(process.env);