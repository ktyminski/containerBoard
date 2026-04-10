import { Redis as UpstashRedis } from "@upstash/redis";
import { createClient, type RedisClientType } from "redis";
import { getEnv } from "@/lib/env";

export type RateLimitRedisClient = {
  incr(key: string): Promise<number>;
  pExpire(key: string, ttlMs: number): Promise<void>;
};

let cachedTcpClient: RedisClientType | null = null;
let connectPromise: Promise<RedisClientType | null> | null = null;
let cachedUpstashClient: UpstashRedis | null = null;

function getUpstashClient(): RateLimitRedisClient | null {
  const env = getEnv();
  const url = env.UPSTASH_REDIS_REST_URL?.trim();
  const token = env.UPSTASH_REDIS_REST_TOKEN?.trim() || env.REDIS_TOKEN?.trim();
  if (!url || !token) {
    return null;
  }

  if (!cachedUpstashClient) {
    cachedUpstashClient = new UpstashRedis({ url, token });
  }

  return {
    incr: (key) => cachedUpstashClient!.incr(key),
    pExpire: async (key, ttlMs) => {
      await cachedUpstashClient!.pexpire(key, ttlMs);
    },
  };
}

async function getTcpRedisClient(): Promise<RateLimitRedisClient | null> {
  const redisUrl = getEnv().REDIS_URL?.trim();
  if (!redisUrl) {
    return null;
  }

  if (cachedTcpClient?.isOpen) {
    return {
      incr: (key) => cachedTcpClient!.incr(key),
      pExpire: async (key, ttlMs) => {
        await cachedTcpClient!.pExpire(key, ttlMs);
      },
    };
  }

  if (!cachedTcpClient) {
    cachedTcpClient = createClient({ url: redisUrl });
    cachedTcpClient.on("error", () => {
      // Keep the app running even if Redis is temporarily unavailable.
    });
  }

  if (!connectPromise) {
    connectPromise = cachedTcpClient
      .connect()
      .then(() => cachedTcpClient)
      .catch(() => {
        cachedTcpClient = null;
        return null;
      })
      .finally(() => {
        connectPromise = null;
      });
  }

  const connectedClient = await connectPromise;
  if (!connectedClient) {
    return null;
  }

  return {
    incr: (key) => connectedClient.incr(key),
    pExpire: async (key, ttlMs) => {
      await connectedClient.pExpire(key, ttlMs);
    },
  };
}

export async function getRedisClient(): Promise<RateLimitRedisClient | null> {
  const upstashClient = getUpstashClient();
  if (upstashClient) {
    return upstashClient;
  }

  return getTcpRedisClient();
}
