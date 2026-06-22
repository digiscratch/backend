import Redis from "ioredis";
import { env } from "../config/env";
import { logger } from "../lib/logger";

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

export class RateLimitService {
  private readonly memory = new Map<string, { count: number; resetAt: number }>();
  private readonly redis?: Redis;

  constructor() {
    if (env.REDIS_URL) {
      this.redis = new Redis(env.REDIS_URL, {
        connectTimeout: 2000,
        enableOfflineQueue: false,
        family: 0,
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        retryStrategy: () => null
      });

      this.redis.on("error", (error) => {
        logger.warn({ error }, "Redis unavailable, using in-memory rate limiting");
      });

      this.redis.connect().catch(() => {
        this.redis?.disconnect();
      });
    }
  }

  async check(key: string, maxAttempts: number, windowSeconds: number): Promise<RateLimitResult> {
    if (this.redis?.status === "ready") {
      const count = await this.redis.incr(key);

      if (count === 1) {
        await this.redis.expire(key, windowSeconds);
      }

      const ttl = await this.redis.ttl(key);
      return {
        allowed: count <= maxAttempts,
        remaining: Math.max(0, maxAttempts - count),
        resetAt: Date.now() + Math.max(ttl, 0) * 1000
      };
    }

    const now = Date.now();
    const existing = this.memory.get(key);

    if (!existing || existing.resetAt <= now) {
      const resetAt = now + windowSeconds * 1000;
      this.memory.set(key, { count: 1, resetAt });
      return { allowed: true, remaining: maxAttempts - 1, resetAt };
    }

    existing.count += 1;
    this.memory.set(key, existing);

    return {
      allowed: existing.count <= maxAttempts,
      remaining: Math.max(0, maxAttempts - existing.count),
      resetAt: existing.resetAt
    };
  }
}

export const rateLimitService = new RateLimitService();
