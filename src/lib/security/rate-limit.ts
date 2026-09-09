import { Redis } from "@upstash/redis";
import type { NextRequest } from "next/server";
import { env, hasUpstashConfig } from "../env";

interface RateLimitInput {
  key: string;
  limit: number;
  windowSeconds: number;
}

interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
}

interface MemoryBucket {
  count: number;
  resetAt: number;
}

const memoryBuckets = new Map<string, MemoryBucket>();

let redisClient: Redis | null = null;

function getRedis(): Redis | null {
  if (!hasUpstashConfig()) {
    return null;
  }

  if (!redisClient) {
    redisClient = new Redis({
      url: env.UPSTASH_REDIS_REST_URL!,
      token: env.UPSTASH_REDIS_REST_TOKEN!
    });
  }

  return redisClient;
}

export function getClientIp(request: NextRequest): string {
  const cfIp = request.headers.get("cf-connecting-ip");
  if (cfIp) {
    return cfIp;
  }

  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || "unknown";
  }

  return request.headers.get("x-real-ip") ?? "unknown";
}

export async function rateLimitRequest(input: RateLimitInput): Promise<RateLimitResult> {
  const now = Date.now();
  const windowMs = input.windowSeconds * 1000;
  const resetAt = now + windowMs;
  const redis = getRedis();

  if (redis) {
    const bucketKey = `rate-limit:${input.key}:${Math.floor(now / windowMs)}`;
    const count = await redis.incr(bucketKey);

    if (count === 1) {
      await redis.expire(bucketKey, input.windowSeconds);
    }

    return {
      allowed: count <= input.limit,
      limit: input.limit,
      remaining: Math.max(0, input.limit - count),
      resetAt
    };
  }

  const existing = memoryBuckets.get(input.key);
  const bucket = existing && existing.resetAt > now ? existing : { count: 0, resetAt };
  bucket.count += 1;
  memoryBuckets.set(input.key, bucket);

  return {
    allowed: bucket.count <= input.limit,
    limit: input.limit,
    remaining: Math.max(0, input.limit - bucket.count),
    resetAt: bucket.resetAt
  };
}

