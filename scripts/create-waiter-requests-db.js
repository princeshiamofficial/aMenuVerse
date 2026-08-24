import mysql from "mysql2/promise";

async function initDb() {
  const host = process.env.MYSQL_HOST || "localhost";
  const port = process.env.MYSQL_PORT ? parseInt(process.env.MYSQL_PORT) : 3306;
  const user = process.env.MYSQL_USER || "root";
  const password = process.env.MYSQL_PASSWORD || "";
  const database = process.env.MYSQL_DATABASE || "amenuverse";

  console.log(`Connecting to MySQL ${database} database at ${host}:${port}...`);
  try {
    const connection = await mysql.createConnection({
      host,
      port,
      user,
      password,
      database,
    });

    console.log("Connected to database!");

    await connection.query(`
      CREATE TABLE IF NOT EXISTS waiter_requests (
        id VARCHAR(36) PRIMARY KEY,
        restaurant_id INT NOT NULL DEFAULT 1,
        branch_id VARCHAR(100),
        table_no VARCHAR(50) NOT NULL,
        type ENUM('call','water','bill','custom') DEFAULT 'call',
        note TEXT,
        status ENUM('pending','acknowledged','done') DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_restaurant_status (restaurant_id, status),
        INDEX idx_table (restaurant_id, table_no)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    console.log("Table 'waiter_requests' ensured successfully.");
    await connection.end();
  } catch (err) {
    console.warn(
      "MySQL connection notice (application will auto-ensure via server functions):",
      err.message,
    );
  }
}

initDb();
