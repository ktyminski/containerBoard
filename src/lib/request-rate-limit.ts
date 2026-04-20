import type { Collection } from "mongodb";
import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/lib/mongodb";
import { getRedisClient } from "@/lib/redis";
import { getRequestIp } from "@/lib/turnstile";

type RateLimitDocument = {
  _id: string;
  count: number;
  createdAt: Date;
  expiresAt: Date;
};

let indexesReadyPromise: Promise<void> | null = null;

export type RateLimitStorageErrorMode = "allow" | "block";

async function getRateLimitCollection(): Promise<Collection<RateLimitDocument>> {
  const db = await getDb();
  return db.collection<RateLimitDocument>("rate_limits");
}

async function ensureRateLimitIndexes(): Promise<void> {
  if (!indexesReadyPromise) {
    indexesReadyPromise = (async () => {
      const collection = await getRateLimitCollection();
      await collection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
    })();
  }
  await indexesReadyPromise;
}

function getWindowBucket(now: Date, windowMs: number): number {
  return Math.floor(now.getTime() / windowMs);
}

function getRetryAfterSeconds(now: Date, windowMs: number, bucket: number): number {
  const nextWindowAt = (bucket + 1) * windowMs;
  return Math.max(1, Math.ceil((nextWindowAt - now.getTime()) / 1000));
}

function buildRateLimitResponse(limit: number, retryAfterSeconds: number): NextResponse {
  return NextResponse.json(
    {
      error: "Rate limit exceeded",
      retryAfterSeconds,
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfterSeconds),
        "X-RateLimit-Limit": String(limit),
        "X-RateLimit-Remaining": "0",
      },
    },
  );
}

function buildRateLimitUnavailableResponse(): NextResponse {
  return NextResponse.json(
    {
      error: "Rate limiting temporarily unavailable",
    },
    { status: 503 },
  );
}

export function getRateLimitIdentity(request: Request | NextRequest): string {
  return getRequestIp(request.headers) ?? "unknown";
}

export async function enforceRateLimitOrResponse(input: {
  request: Request | NextRequest;
  scope: string;
  limit: number;
  windowMs: number;
  identity?: string;
  onError?: RateLimitStorageErrorMode;
}): Promise<NextResponse | null> {
  const identity = input.identity?.trim() || getRateLimitIdentity(input.request);
  const now = new Date();
  const bucket = getWindowBucket(now, input.windowMs);
  const key = `${input.scope}:${identity}:${bucket}`;
  const retryAfterSeconds = getRetryAfterSeconds(now, input.windowMs, bucket);

  // Prefer Redis when configured for lower latency atomic increments.
  const redisClient = await getRedisClient();
  if (redisClient) {
    try {
      const redisKey = `rate_limit:${key}`;
      const count = await redisClient.incr(redisKey);
      if (count === 1) {
        await redisClient.pExpire(redisKey, input.windowMs * 2);
      }

      if (count <= input.limit) {
        return null;
      }

      return buildRateLimitResponse(input.limit, retryAfterSeconds);
    } catch {
      // Fall back to MongoDB below if Redis is temporarily unavailable.
    }
  }

  try {
    await ensureRateLimitIndexes();
    const collection = await getRateLimitCollection();
    const expiresAt = new Date((bucket + 2) * input.windowMs);

    const result = await collection.findOneAndUpdate(
      { _id: key },
      {
        $inc: { count: 1 },
        $setOnInsert: {
          createdAt: now,
          expiresAt,
        },
      },
      {
        upsert: true,
        returnDocument: "after",
      },
    );

    const count = result?.count ?? 1;
    if (count <= input.limit) {
      return null;
    }

    return buildRateLimitResponse(input.limit, retryAfterSeconds);
  } catch {
    return input.onError === "block" ? buildRateLimitUnavailableResponse() : null;
  }
}
