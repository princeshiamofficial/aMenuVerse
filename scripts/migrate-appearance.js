const mysql = require("mysql2/promise");
const fs = require("fs");
const path = require("path");

function loadEnv() {
  const envPath = path.join(__dirname, "..", ".env.local");
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, "utf8");
    content.split("\n").forEach((line) => {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let value = match[2] || "";
        if (value.startsWith('"') && value.endsWith('"')) {
          value = value.slice(1, -1);
        } else if (value.startsWith("'") && value.endsWith("'")) {
          value = value.slice(1, -1);
        }
        process.env[key] = value.trim();
      }
    });
    console.log("Loaded configurations from .env.local");
  }
}

loadEnv();

const MYSQL_HOST = process.env.MYSQL_HOST || "localhost";
const MYSQL_PORT = process.env.MYSQL_PORT || 3306;
const MYSQL_USER = process.env.MYSQL_USER || "root";
const MYSQL_PASSWORD = process.env.MYSQL_PASSWORD || "";
const MYSQL_DATABASE = process.env.MYSQL_DATABASE || "digital_food_menu";

async function migrate() {
  const connection = await mysql.createConnection({
    host: MYSQL_HOST,
    port: parseInt(MYSQL_PORT, 10),
    user: MYSQL_USER,
    password: MYSQL_PASSWORD,
    database: MYSQL_DATABASE,
  });

  console.log("Altering restaurants table to support appearance themes...");

  try {
    await connection.query(`
      ALTER TABLE restaurants 
      ADD COLUMN primary_color VARCHAR(50) DEFAULT '#ff7a00',
      ADD COLUMN font_family VARCHAR(50) DEFAULT 'Outfit',
      ADD COLUMN layout_type VARCHAR(50) DEFAULT 'grid'
    `);
    console.log("Migration successful: columns added.");
  } catch (err) {
    if (err.code === "ER_DUP_COLUMN_NAME") {
      console.log("Columns already exist. Skipping.");
    } else {
      console.error("Migration error:", err);
    }
  } finally {
    await connection.end();
  }
}

migrate();
