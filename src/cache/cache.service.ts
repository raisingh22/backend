import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

interface MemCacheEntry {
  value: any;
  expiresAt: number;
}

@Injectable()
export class CacheService implements OnModuleInit {
  private readonly logger = new Logger(CacheService.name);
  private redis: any = null;
  private memCache = new Map<string, MemCacheEntry>();

  async onModuleInit() {
    const redisUrl = process.env.REDIS_URL || process.env.REDIS_HOST;

    if (redisUrl) {
      try {
        const Redis = (await import('ioredis')).default as any;
        this.redis = new Redis(redisUrl, {
          lazyConnect: true,
          enableReadyCheck: true,
          maxRetriesPerRequest: 1,
          connectTimeout: 3000,
        });

        await this.redis.connect();
        this.logger.log('✅ Redis connected — using distributed cache');
      } catch (err) {
        this.logger.warn(
          `⚠️  Redis connection failed (${(err as Error).message}). Falling back to in-memory cache.`,
        );
        this.redis = null;
      }
    } else {
      this.logger.log(
        'ℹ️  No REDIS_URL configured — using in-memory cache (local dev mode)',
      );
    }
  }

  async get<T = any>(key: string): Promise<T | null> {
    if (this.redis) {
      const raw = await this.redis.get(key);
      return raw ? (JSON.parse(raw) as T) : null;
    }

    const entry = this.memCache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.memCache.delete(key);
      return null;
    }
    return entry.value as T;
  }

  async set(key: string, value: any, ttlSeconds = 60): Promise<void> {
    if (this.redis) {
      await this.redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
      return;
    }

    this.memCache.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  async del(key: string): Promise<void> {
    if (this.redis) {
      await this.redis.del(key);
      return;
    }
    this.memCache.delete(key);
  }

  /**
   * Invalidate all cache keys that start with `prefix`.
   * In Redis: uses SCAN to avoid blocking. In memory: O(n) over cached keys.
   */
  async flushPattern(prefix: string): Promise<void> {
    if (this.redis) {
      let cursor = '0';
      do {
        const [nextCursor, keys] = await this.redis.scan(
          cursor,
          'MATCH',
          `${prefix}*`,
          'COUNT',
          100,
        );
        cursor = nextCursor;
        if (keys.length) await this.redis.del(...keys);
      } while (cursor !== '0');
      return;
    }

    // In-memory: iterate and delete matching keys
    for (const key of this.memCache.keys()) {
      if (key.startsWith(prefix)) {
        this.memCache.delete(key);
      }
    }
  }

  /** Build a namespaced cache key: {workspaceId}:{module}:{url-path} */
  static buildKey(workspaceId: string, module: string, suffix: string): string {
    return `ws:${workspaceId}:${module}:${suffix}`;
  }

  /** Build a prefix for flush: {workspaceId}:{module}: */
  static modulePrefix(workspaceId: string, module: string): string {
    return `ws:${workspaceId}:${module}:`;
  }
}
