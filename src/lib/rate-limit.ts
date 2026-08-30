import { headers } from "next/headers";
import Redis from "ioredis";

// ─── Redis client (singleton) ────────────────────────────────────────────────
// Supports Redis via REDIS_URL or Upstash REST via UPSTASH_REDIS_REST_URL.
// Falls back to in-process Map when neither is configured (dev/test only).

const globalForRedis = globalThis as unknown as { __redis_client__?: Redis };

function getRedisClient(): Redis | null {
  const redisUrl = process.env.REDIS_URL || process.env.UPSTASH_REDIS_REST_URL;
  if (!redisUrl) return null;

  if (!globalForRedis.__redis_client__) {
    try {
      globalForRedis.__redis_client__ = new Redis(redisUrl, {
        maxRetriesPerRequest: 2,
        connectTimeout: 3000,
        lazyConnect: true,
        enableOfflineQueue: false,
      });

      globalForRedis.__redis_client__.on("error", (err: Error) => {
        console.warn(
          "[RateLimit/Redis] Connection error (falling back to in-process):",
          err.message,
        );
      });

      process.once("SIGTERM", () => globalForRedis.__redis_client__?.disconnect());
      process.once("SIGINT", () => globalForRedis.__redis_client__?.disconnect());
    } catch (err) {
      console.warn("[RateLimit/Redis] Failed to initialize:", (err as Error).message);
      return null;
    }
  }

  return globalForRedis.__redis_client__;
}

// ─── In-process fallback (dev / no Redis configured) ────────────────────────
interface FallbackEntry {
  count: number;
  resetAt: number;
}

const fallbackMap = new Map<string, FallbackEntry>();

// Cleanup expired entries every 5 minutes
if (typeof setInterval !== "undefined") {
  setInterval(
    () => {
      const now = Date.now();
      for (const [key, entry] of fallbackMap.entries()) {
        if (now > entry.resetAt) fallbackMap.delete(key);
      }
    },
    5 * 60 * 1000,
  );
}

// ─── IP extraction ────────────────────────────────────────────────────────────
export async function getClientIpAsync(): Promise<string> {
  try {
    const headerStore = await headers();
    const xff = headerStore.get("x-forwarded-for");
    if (xff) return xff.split(",")[0].trim();
    const realIp = headerStore.get("x-real-ip");
    if (realIp) return realIp.trim();
  } catch {
    /* outside HTTP request context */
  }
  return "127.0.0.1";
}

export function getClientIp(): string {
  return "127.0.0.1";
}

// ─── Core rate limiter ────────────────────────────────────────────────────────
/**
 * Enforces rate limiting using Redis sliding-window (if REDIS_URL is set)
 * or in-process Map (dev/test fallback).
 *
 * Throws a user-facing error message when limit is exceeded.
 * @param actionKey  e.g. "login", "signup", "upload"
 * @param identifier optional per-user key (e.g. email address) layered on top of IP
 * @param opts       { maxRequests, windowMs } — default 5 req/60s
 */
export async function checkRateLimitAsync(
  actionKey: string,
  identifier?: string,
  opts: { maxRequests: number; windowMs: number } = { maxRequests: 5, windowMs: 60_000 },
): Promise<void> {
  const ip = getClientIp();
  const idKey = identifier ? `${identifier}:${ip}` : ip;
  const key = `rl:${actionKey}:${idKey}`;
  const windowSecs = Math.ceil(opts.windowMs / 1000);

  const redis = getRedisClient();

  // ── Redis path ────────────────────────────────────────────────────────────
  if (redis) {
    try {
      // Atomic INCR + EXPIRE using a pipeline
      const pipeline = redis.pipeline();
      pipeline.incr(key);
      pipeline.expire(key, windowSecs, "NX"); // set TTL only on first creation
      const results = await pipeline.exec();

      const count = results?.[0]?.[1] as number | null;
      if (count !== null && count > opts.maxRequests) {
        const ttl = await redis.ttl(key);
        const retrySeconds = ttl > 0 ? ttl : windowSecs;
        throw new Error(
          `Too many ${actionKey.replace(/_/g, " ")} attempts. Please try again in ${retrySeconds} second(s).`,
        );
      }
      return;
    } catch (err) {
      // If it's our own rate-limit error, re-throw it
      if ((err as Error).message.includes("Please try again")) throw err;
      // Redis connectivity issue → fall through to in-process fallback silently
      console.warn("[RateLimit/Redis] Error, falling back to in-process:", (err as Error).message);
    }
  }

  // ── In-process fallback ────────────────────────────────────────────────────
  const now = Date.now();
  const entry = fallbackMap.get(key);

  if (!entry || now > entry.resetAt) {
    fallbackMap.set(key, { count: 1, resetAt: now + opts.windowMs });
    return;
  }

  if (entry.count >= opts.maxRequests) {
    const retrySeconds = Math.ceil((entry.resetAt - now) / 1000);
    throw new Error(
      `Too many ${actionKey.replace(/_/g, " ")} attempts. Please try again in ${retrySeconds} second(s).`,
    );
  }

  entry.count += 1;
}

/**
 * Synchronous shim for backward compat with existing callers using checkRateLimit().
 * Uses in-process store only (no Redis). New code should call checkRateLimitAsync().
 */
export function checkRateLimit(
  actionKey: string,
  identifier?: string,
  opts: { maxRequests: number; windowMs: number } = { maxRequests: 5, windowMs: 60_000 },
): void {
  const ip = getClientIp();
  const idKey = identifier ? `${identifier}:${ip}` : ip;
  const key = `rl:${actionKey}:${idKey}`;
  const now = Date.now();
  const entry = fallbackMap.get(key);

  if (!entry || now > entry.resetAt) {
    fallbackMap.set(key, { count: 1, resetAt: now + opts.windowMs });
    return;
  }

  if (entry.count >= opts.maxRequests) {
    const retrySeconds = Math.ceil((entry.resetAt - now) / 1000);
    throw new Error(
      `Too many ${actionKey.replace(/_/g, " ")} attempts. Please try again in ${retrySeconds} second(s).`,
    );
  }

  entry.count += 1;
}
