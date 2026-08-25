import mysql from "mysql2/promise";

// Singleton connection pool across Vite HMR reloads
const globalForMysql = globalThis as unknown as {
  __mysql_pool__?: mysql.Pool;
  __mysql_tables_initialized__?: boolean;
};

import { runDatabaseMigrations } from "./migrations";

export async function ensureAllTablesExist(): Promise<void> {
  if (globalForMysql.__mysql_tables_initialized__) return;
  const pool = getPool();
  try {
    await runDatabaseMigrations(pool);
    globalForMysql.__mysql_tables_initialized__ = true;
  } catch (err) {
    console.warn("[MySQL] Auto table migration warning:", (err as Error).message);
  }
}

export function getPool(): mysql.Pool {
  if (!globalForMysql.__mysql_pool__) {
    const host = process.env.MYSQL_HOST || "localhost";
    const port = process.env.MYSQL_PORT ? parseInt(process.env.MYSQL_PORT) : 3306;
    const user = process.env.MYSQL_USER || "root";
    const password = process.env.MYSQL_PASSWORD || "";
    const database = process.env.MYSQL_DATABASE || "amenuverse";

    console.log(
      `[MySQL] Initializing connection pool to ${host}:${port}/${database} as user ${user}`,
    );
    globalForMysql.__mysql_pool__ = mysql.createPool({
      host,
      port,
      user,
      password,
      database,
      waitForConnections: true,
      connectionLimit: 10,
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

    // Auto verify & create missing database tables on pool creation
    ensureAllTablesExist().catch(() => {});
  }
  return globalForMysql.__mysql_pool__;
}

// Helper to run a query with automatic connection release & auto table creation fallback
export async function query<T = unknown>(sql: string, params?: mysql.ExecuteValues): Promise<T> {
  const connectionPool = getPool();
  try {
    const [rows] = await connectionPool.execute(sql, params);
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
      const [retryRows] = await connectionPool.execute(sql, params);
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
