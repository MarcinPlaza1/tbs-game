import { TRPCError } from '@trpc/server';

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

// In-memory storage for rate limiting
const rateLimitStore = new Map<string, RateLimitEntry>();

// Default configuration
const defaultConfig: RateLimitConfig = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 100,
};

// Endpoint-specific configurations
const endpointConfigs: Record<string, RateLimitConfig> = {
  'auth.login': {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5,
  },
  'auth.register': {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 3,
  },
  'auth.passwordResetRequest': {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 3,
  },
  'auth.refreshToken': {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 10,
  },
};

export function checkRateLimit(endpoint: string, identifier: string): void {
  const config = endpointConfigs[endpoint] || defaultConfig;
  const key = `${endpoint}:${identifier}`;
  const now = Date.now();

  let entry = rateLimitStore.get(key);

  if (!entry || now > entry.resetTime) {
    // Create new entry or reset existing one
    entry = {
      count: 1,
      resetTime: now + config.windowMs,
    };
    rateLimitStore.set(key, entry);
    return;
  }

  if (entry.count >= config.maxRequests) {
    const resetTimeDate = new Date(entry.resetTime);
    throw new TRPCError({
      code: 'TOO_MANY_REQUESTS',
      message: `Rate limit exceeded. Try again after ${resetTimeDate.toISOString()}`,
    });
  }

  entry.count++;
  rateLimitStore.set(key, entry);
}

// Cleanup function to remove old entries
export function cleanupRateLimit(): void {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}

// Run cleanup every 5 minutes
setInterval(cleanupRateLimit, 5 * 60 * 1000);