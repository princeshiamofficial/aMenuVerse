import { getPool } from "@/lib/mysql";

export const dynamic = "force-dynamic";

interface DatabaseCheck {
  ok: boolean;
  latency_ms?: number;
  error?: string;
}

interface EnvironmentCheck {
  ok: boolean;
  missing_vars?: string[];
}

interface HealthStatus {
  status: "healthy" | "degraded" | "unhealthy";
  version: string;
  timestamp: string;
  uptime_seconds: number;
  checks: {
    database: DatabaseCheck;
    environment: EnvironmentCheck;
  };
}

const REQUIRED_ENV_VARS = ["MYSQL_HOST", "MYSQL_USER", "MYSQL_PASSWORD", "MYSQL_DATABASE"];

export async function GET() {
  const uptimeSeconds = Math.floor(process.uptime());

  const checks: HealthStatus["checks"] = {
    database: { ok: false },
    environment: { ok: false },
  };

  // Environment variable check
  const missingVars = REQUIRED_ENV_VARS.filter((v) => !process.env[v]);
  checks.environment = {
    ok: missingVars.length === 0,
    missing_vars: missingVars.length > 0 ? missingVars : undefined,
  };

  // Database connectivity check
  const dbStart = Date.now();
  try {
    const pool = getPool();
    await pool.execute("SELECT 1");
    checks.database = { ok: true, latency_ms: Date.now() - dbStart };
  } catch (err: unknown) {
    checks.database = {
      ok: false,
      latency_ms: Date.now() - dbStart,
      error: (err as Error).message,
    };
  }

  const allOk = checks.database.ok && checks.environment.ok;
  const status: HealthStatus["status"] = allOk
    ? "healthy"
    : checks.database.ok
      ? "degraded"
      : "unhealthy";

  const body: HealthStatus = {
    status,
    version: process.env.npm_package_version ?? "0.0.0",
    timestamp: new Date().toISOString(),
    uptime_seconds: uptimeSeconds,
    checks,
  };

  return new Response(JSON.stringify(body, null, 2), {
    status: allOk ? 200 : 503,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}
