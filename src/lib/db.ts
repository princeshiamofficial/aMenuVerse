import mysql from "mysql2/promise";

const pool = mysql.createPool({
  host: process.env.MYSQL_HOST || "localhost",
  port: parseInt(process.env.MYSQL_PORT || "3306", 10),
  user: process.env.MYSQL_USER || "root",
  password: process.env.MYSQL_PASSWORD || "",
  database: process.env.MYSQL_DATABASE || "digital_food_menu",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

export async function query<T = any>(sql: string, params?: any[]): Promise<T> {
  const [results] = await pool.execute(sql, params);
  return results as T;
}

export default pool;
