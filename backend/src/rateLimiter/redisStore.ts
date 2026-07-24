import type { Store, IncrementCallback, ClientRateLimitInfo } from "express-rate-limit";
import Redis from "ioredis";

type RedisStoreOptions = {
  prefix?: string;
  sendCommand?: (...args: string[]) => Promise<unknown>;
};

export class RedisStore implements Store {
  prefix: string;
  redis: Redis;
  windowMs: number;

  constructor(options: { redis: Redis; prefix?: string; windowMs?: number }) {
    this.redis = options.redis;
    this.prefix = options.prefix ?? "rl:";
    this.windowMs = options.windowMs ?? 60_000;
  }

  prefixKey(key: string): string {
    return `${this.prefix}${key}`;
  }

  async increment(key: string): Promise<ClientRateLimitInfo> {
    const prefixedKey = this.prefixKey(key);
    const windowSecs = Math.ceil(this.windowMs / 1000) || 1;

    const results = (await this.redis
      .multi()
      .incr(prefixedKey)
      .expire(prefixedKey, windowSecs)
      .pttl(prefixedKey)
      .exec()) as [Error | null, string][];

    const totalHits = Number(results[0]?.[1] ?? 1);
    const resetTime = new Date(Date.now() + Number(results[2]?.[1] ?? this.windowMs));
    const resetTimeMs = resetTime.getTime();

    return { totalHits, resetTime: new Date(resetTimeMs) };
  }

  async decrement(key: string): Promise<void> {
    await this.redis.decr(this.prefixKey(key));
  }

  async resetKey(key: string): Promise<void> {
    await this.redis.del(this.prefixKey(key));
  }

  async shutdown(): Promise<void> {
    await this.redis.quit();
  }
}
