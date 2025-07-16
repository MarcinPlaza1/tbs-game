import { config } from 'dotenv';
import { z } from 'zod';
import path from 'path';

// Try to load .env from multiple locations
config({ path: path.join(process.cwd(), '.env') });
config({ path: path.join(process.cwd(), '..', '.env') });
config({ path: path.join(process.cwd(), '..', 'server', '.env') });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  GAME_SERVER_PORT: z.string().transform(Number).default('2567'),
  JWT_SECRET: z.string().default('your-super-secret-jwt-key-change-this-in-production'),
  DATABASE_URL: z.string().default('postgresql://postgres:User123@localhost:5432/tbs_game'),
});

export const env = envSchema.parse(process.env);