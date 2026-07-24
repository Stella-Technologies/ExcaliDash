import Redis from "ioredis";
import { config } from "../config";

let redisClient: Redis | null = null;

export const getRedisClient = (): Redis | null => {
  if (redisClient) return redisClient;
  if (!config.redis.enabled) return null;

  const commonOpts: Record<string, unknown> = {
    enableOfflineQueue: false,
    maxRetriesPerRequest: 3,
    retryStrategy: (times: number) => {
      if (times > 5) return null;
      return Math.min(times * 200, 2000);
    },
  };

  try {
    if (config.redis.url) {
      redisClient = new Redis(config.redis.url, commonOpts);
    } else {
      Object.assign(commonOpts, {
        host: config.redis.host,
        port: config.redis.port,
        db: config.redis.db,
      });
      if (config.redis.password) commonOpts.password = config.redis.password;
      if (config.redis.tls) commonOpts.tls = {};
      redisClient = new Redis(commonOpts);
    }

    redisClient.on("error", (err) => {
      console.warn("[redis] Connection error (rate limiters will fall back to in-memory):", err.message);
    });
    redisClient.on("connect", () => {
      console.log("[redis] Connected for rate limiting");
    });
  } catch {
    console.warn("[redis] Failed to create client. Rate limiters will use in-memory store.");
    return null;
  }

  return redisClient;
};

export const shutdownRedis = async (): Promise<void> => {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
};