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
 * Helper to dynamically create a missing column when MySQL returns ER_BAD_FIELD_ERROR (1054).
 */
async function autoAddMissingColumn(errorMessage: string, sql: string): Promise<boolean> {
  try {
    const pool = getPool();
    // Match: Unknown column 'col_name' in 'field list' or 'where clause'
    const colMatch = errorMessage.match(/Unknown column '([^']+)'/i);
    if (!colMatch) return false;
    const missingCol = colMatch[1];

    // Detect target table from SQL query
    let targetTable: string | null = null;
    const tableMatch =
      sql.match(/FROM\s+[`]?([a-zA-Z0-9_]+)[`]?/i) ||
      sql.match(/UPDATE\s+[`]?([a-zA-Z0-9_]+)[`]?/i) ||
      sql.match(/INTO\s+[`]?([a-zA-Z0-9_]+)[`]?/i);
    if (tableMatch) {
      targetTable = tableMatch[1];
    }

    if (!targetTable) return false;

    console.log(`[MySQL] Auto-detected missing column '${missingCol}' in table '${targetTable}'. Dynamically creating...`);

    // Infer column type
    let colType = "VARCHAR(255) NULL";
    if (missingCol.endsWith("_id") || missingCol === "id") {
      colType = "VARCHAR(255) NULL";
    } else if (missingCol.endsWith("_json") || missingCol === "variations" || missingCol === "addons") {
      colType = "JSON NULL";
    } else if (missingCol.startsWith("is_") || missingCol === "active" || missingCol === "is_active") {
      colType = "TINYINT(1) DEFAULT 1";
    } else if (missingCol.includes("price") || missingCol.includes("total") || missingCol.includes("amount") || missingCol.includes("tax")) {
      colType = "DECIMAL(10,2) DEFAULT 0";
    } else if (missingCol.includes("description") || missingCol.includes("about") || missingCol.includes("notes")) {
      colType = "TEXT NULL";
    } else if (missingCol.includes("date") || missingCol.includes("time") || missingCol.includes("at")) {
      colType = "VARCHAR(100) NULL";
    }

    await pool.query(`ALTER TABLE \`${targetTable}\` ADD COLUMN \`${missingCol}\` ${colType}`);
    console.log(`[MySQL] Successfully added column '${missingCol}' to table '${targetTable}'.`);
    return true;
  } catch (err) {
    console.warn("[MySQL] Dynamic column creation notice:", (err as Error).message);
    return false;
  }
}

/**
 * Helper to run a parameterized query with automatic table & column creation and retry fallback.
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
    const mysqlErr = err as { errno?: number; code?: string; message?: string };
    const errMessage = mysqlErr?.message || "";

    // 1. If table doesn't exist (1146 / ER_NO_SUCH_TABLE), run full migrations to create all tables
    if (
      mysqlErr?.errno === 1146 ||
      mysqlErr?.code === "ER_NO_SUCH_TABLE" ||
      errMessage.includes("Table") && errMessage.includes("doesn't exist")
    ) {
      console.log(
        "[MySQL] Table missing. Auto-creating database tables and schema...",
      );
      globalForMysql.__mysql_tables_initialized__ = false;
      await ensureAllTablesExist();
      const [retryRows] = isDDL
        ? await connectionPool.query(sql, params as mysql.ExecuteValues)
        : await connectionPool.execute(sql, params as mysql.ExecuteValues);
      return retryRows as T;
    }

    // 2. If column doesn't exist (1054 / ER_BAD_FIELD_ERROR), auto-add the column and retry
    if (
      mysqlErr?.errno === 1054 ||
      mysqlErr?.code === "ER_BAD_FIELD_ERROR" ||
      errMessage.includes("Unknown column")
    ) {
      const added = await autoAddMissingColumn(errMessage, sql);
      if (added) {
        const [retryRows] = isDDL
          ? await connectionPool.query(sql, params as mysql.ExecuteValues)
          : await connectionPool.execute(sql, params as mysql.ExecuteValues);
        return retryRows as T;
      }
      // Fallback: run global migrations if specific add wasn't parsed
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
