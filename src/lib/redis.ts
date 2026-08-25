import { createClient, RedisClientType } from "redis";

let redisClient: RedisClientType | null = null;
let redisUnavailable = false;

async function getRedisClient(): Promise<RedisClientType | null> {
  if (redisUnavailable) return null;
  if (redisClient) return redisClient;

  const globalRef = global as unknown as {
    redisClient?: RedisClientType;
    redisUnavailable?: boolean;
  };

  if (globalRef.redisUnavailable) {
    redisUnavailable = true;
    return null;
  }

  if (globalRef.redisClient) {
    redisClient = globalRef.redisClient;
    return redisClient;
  }

  try {
    const url = process.env.REDIS_URL || "redis://localhost:6379";

    const client = createClient({
      url,
      socket: {
        connectTimeout: 2000, // fail fast: 2 seconds max to connect
        reconnectStrategy: false, // never auto-reconnect — we handle it ourselves
      },
    });

    client.on("error", () => {
      // Suppress noisy ECONNREFUSED spam
    });

    // Race the connect against a 2.5s hard timeout so we never hang
    await Promise.race([
      client.connect(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Redis connect timeout")), 2500),
      ),
    ]);

    // Disable write protection on bgsave errors to avoid MISCONF blockage
    try {
      await client.sendCommand(["CONFIG", "SET", "stop-writes-on-bgsave-error", "no"]);
    } catch (configErr) {
      console.warn("Could not disable Redis stop-writes-on-bgsave-error:", configErr);
    }

    redisClient = client as RedisClientType;
    globalRef.redisClient = redisClient;
    console.log("Redis connected successfully.");
    return redisClient;
  } catch {
    redisUnavailable = true;
    globalRef.redisUnavailable = true;
    console.warn("Redis unavailable — falling back to MySQL only.");
    return null;
  }
}

// ── Public helpers ──────────────────────────────────────────────────────────

export async function getCachedTenant(username: string): Promise<Record<string, unknown> | null> {
  try {
    const client = await getRedisClient();
    if (!client) return null;
    const data = await client.get(`tenant:${username}:data`);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

export async function setCachedTenant(
  username: string,
  data: Record<string, unknown>,
  ttlSeconds = 3600,
): Promise<void> {
  try {
    const client = await getRedisClient();
    if (!client) return;
    await client.set(`tenant:${username}:data`, JSON.stringify(data), {
      EX: ttlSeconds,
    });
  } catch {
    // Non-fatal
  }
}

export async function invalidateTenantCache(username: string): Promise<void> {
  try {
    const client = await getRedisClient();
    if (!client) return;
    await client.del(`tenant:${username}:data`);
    console.log(`Redis cache invalidated for tenant: ${username}`);
  } catch {
    // Non-fatal
  }
}

export async function blacklistToken(token: string, ttlSeconds: number): Promise<void> {
  try {
    const client = await getRedisClient();
    if (!client) return;
    await client.set(`blacklist:${token}`, "true", { EX: ttlSeconds });
  } catch {
    // Non-fatal
  }
}

export async function isTokenBlacklisted(token: string): Promise<boolean> {
  try {
    const client = await getRedisClient();
    if (!client) return false;
    const exists = await client.get(`blacklist:${token}`);
    return exists === "true";
  } catch {
    return false;
  }
}
