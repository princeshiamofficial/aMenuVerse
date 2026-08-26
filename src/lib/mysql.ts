import mysql from "mysql2/promise";
import { runDatabaseMigrations } from "./migrations";

// Singleton connection pool across Vite HMR reloads and SSR invocations
const globalForMysql = globalThis as unknown as {
  __mysql_pool__?: mysql.Pool;
  __mysql_tables_initialized__?: boolean;
  __mysql_migration_promise__?: Promise<void> | null;
};

/**
 * Idempotently executes database migrations and ensures all tables, indexes, and seeds exist.
 * Concurrency-safe: multiple callers await the same in-flight migration promise.
 */
export async function ensureAllTablesExist(): Promise<void> {
  if (globalForMysql.__mysql_tables_initialized__) return;
  if (globalForMysql.__mysql_migration_promise__) {
    return globalForMysql.__mysql_migration_promise__;
  }

  globalForMysql.__mysql_migration_promise__ = (async () => {
    try {
      const pool = getPool();
      await runDatabaseMigrations(pool);
      globalForMysql.__mysql_tables_initialized__ = true;
      console.log("[MySQL] All tables, indexes, and constraints verified successfully.");
    } catch (err) {
      console.warn("[MySQL] Auto table migration notice:", (err as Error).message);
    } finally {
      globalForMysql.__mysql_migration_promise__ = null;
    }
  })();

  return globalForMysql.__mysql_migration_promise__;
}

/**
 * Returns singleton MySQL connection pool.
 */
export function getPool(): mysql.Pool {
  if (!globalForMysql.__mysql_pool__) {
    const host =
      process.env.DATABASE_HOST ||
      process.env.MYSQL_HOST ||
      process.env.DB_HOST ||
      process.env.MYSQLHOST ||
      "localhost";
    const port = parseInt(
      process.env.DATABASE_PORT ||
        process.env.MYSQL_PORT ||
        process.env.DB_PORT ||
        process.env.MYSQLPORT ||
        "3306",
      10,
    );
    const user =
      process.env.DATABASE_USER ||
      process.env.MYSQL_USER ||
      process.env.DB_USER ||
      process.env.MYSQLUSER ||
      "root";
    const password =
      process.env.DATABASE_PASSWORD ||
      process.env.MYSQL_PASSWORD ||
      process.env.DB_PASSWORD ||
      process.env.MYSQLPASSWORD ||
      process.env.DB_PASS ||
      "";
    const database =
      process.env.DATABASE_NAME ||
      process.env.MYSQL_DATABASE ||
      process.env.DB_NAME ||
      process.env.MYSQLDATABASE ||
      "amenuverse";

    console.log(
      `[MySQL] Initializing connection pool to ${host}:${port}/${database} as user ${user}`,
    );
    globalForMysql.__mysql_pool__ = mysql.createPool({
      host,
      port,
      user,
      password,
      database,
      charset: "utf8mb4",
      waitForConnections: true,
      connectionLimit: 15,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0,
      idleTimeout: 30000,
    });

    const shutdown = () => {
      if (globalForMysql.__mysql_pool__) {
        globalForMysql.__mysql_pool__.end().catch(() => {});
        globalForMysql.__mysql_pool__ = undefined;
      }
    };
    process.once("exit", shutdown);
    process.once("SIGINT", shutdown);
    process.once("SIGTERM", shutdown);

    // Trigger auto-table verification on pool creation
    ensureAllTablesExist().catch(() => {});
  }
  return globalForMysql.__mysql_pool__;
}

export type QueryParams =
  | (string | number | bigint | boolean | Date | Buffer | null | undefined | unknown)[]
  | Record<string, unknown>;

/**
 * Helper to run a parameterized query with automatic table creation & retry fallback.
 */
export async function query<T = unknown>(sql: string, params?: QueryParams): Promise<T> {
  if (!globalForMysql.__mysql_tables_initialized__) {
    await ensureAllTablesExist();
  }

  const connectionPool = getPool();
  const isDDL = /^\s*(ALTER|CREATE|DROP|TRUNCATE|RENAME)\b/i.test(sql);
  try {
    const [rows] = isDDL
      ? await connectionPool.query(sql, params as mysql.ExecuteValues)
      : await connectionPool.execute(sql, params as mysql.ExecuteValues);
    return rows as T;
  } catch (err: unknown) {
    const mysqlErr = err as { errno?: number; code?: string };
    // If table or column doesn't exist (1146 / 1054), auto-create database schema & retry seamlessly
    if (
      mysqlErr?.errno === 1146 ||
      mysqlErr?.code === "ER_NO_SUCH_TABLE" ||
      mysqlErr?.errno === 1054 ||
      mysqlErr?.code === "ER_BAD_FIELD_ERROR"
    ) {
      console.log(
        "[MySQL] Table or column missing. Auto-creating database schema & retrying query...",
      );
      globalForMysql.__mysql_tables_initialized__ = false;
      await ensureAllTablesExist();
      const [retryRows] = isDDL
        ? await connectionPool.query(sql, params as mysql.ExecuteValues)
        : await connectionPool.execute(sql, params as mysql.ExecuteValues);
      return retryRows as T;
    }
    throw err;
  }
}

/**
 * Execute a batch of SQL queries inside an ACID MySQL transaction.
 * Automatically handles connection acquisition, beginTransaction, commit, rollback, and connection.release().
 */
export async function transaction<T = unknown>(
  callback: (conn: mysql.PoolConnection) => Promise<T>,
): Promise<T> {
  if (!globalForMysql.__mysql_tables_initialized__) {
    await ensureAllTablesExist();
  }

  const pool = getPool();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}
