import { createRequire } from "module";
import { fileURLToPath } from "url";
import { dirname } from "path";

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const mysql = require("mysql2/promise");
const fs = require("fs");
const path = require("path");

// Helper to manually parse .env and .env.local files
function loadEnv() {
  const envFiles = [".env", ".env.local"];
  let loaded = false;
  envFiles.forEach((file) => {
    const envPath = path.join(__dirname, "..", file);
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, "utf8");
      content.split("\n").forEach((line) => {
        const cleanLine = line.trim();
        const match = cleanLine.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
        if (match) {
          const key = match[1];
          let value = (match[2] || "").trim();
          // Remove quotes if present
          if (value.startsWith('"') && value.endsWith('"')) {
            value = value.slice(1, -1);
          } else if (value.startsWith("'") && value.endsWith("'")) {
            value = value.slice(1, -1);
          }
          process.env[key] = value.trim();
        }
      });
      console.log(`Loaded configurations from ${file}`);
      loaded = true;
    }
  });
  if (!loaded) {
    console.warn(".env or .env.local not found. Using system environment variables.");
  }
}

loadEnv();

const MYSQL_HOST = process.env.MYSQL_HOST || "localhost";
const MYSQL_PORT = parseInt(process.env.MYSQL_PORT || "3306", 10);
const MYSQL_USER = process.env.MYSQL_USER || "root";
const MYSQL_PASSWORD = process.env.MYSQL_PASSWORD || "";
const MYSQL_DATABASE = process.env.MYSQL_DATABASE || "digital_food_menu";

async function main() {
  console.log(`Connecting to database: ${MYSQL_DATABASE} on ${MYSQL_HOST}:${MYSQL_PORT}...`);

  const connection = await mysql.createConnection({
    host: MYSQL_HOST,
    port: MYSQL_PORT,
    user: MYSQL_USER,
    password: MYSQL_PASSWORD,
    database: MYSQL_DATABASE,
  });

  try {
    console.log("Creating database tables if they do not exist (without seed)...");

    // Disable Foreign Key checks temporarily
    await connection.query("SET FOREIGN_KEY_CHECKS = 0");

    // 1. Restaurants Table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS restaurants (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        cuisine VARCHAR(255),
        rating VARCHAR(50),
        reviews VARCHAR(50),
        price VARCHAR(50),
        time VARCHAR(50),
        location VARCHAR(255),
        logo VARCHAR(50),
        logo_bg VARCHAR(255),
        image VARCHAR(512),
        logo_image VARCHAR(512),
        username VARCHAR(100) UNIQUE NOT NULL,
        phone VARCHAR(50),
        operating_hours VARCHAR(255),
        facilities VARCHAR(512),
        intro_text TEXT,
        description_text TEXT,
        primary_color VARCHAR(50) DEFAULT '#ff7a00',
        font_family VARCHAR(50) DEFAULT 'Outfit',
        layout_type VARCHAR(50) DEFAULT 'grid',
        offer_slides TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("- Verified/Created table: restaurants");

    // 2. Branches Table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS branches (
        id VARCHAR(100) PRIMARY KEY,
        restaurant_id INT NOT NULL,
        name VARCHAR(255) NOT NULL,
        location VARCHAR(255),
        phone VARCHAR(50),
        operating_hours VARCHAR(255),
        FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE
      )
    `);
    console.log("- Verified/Created table: branches");

    // 3. Branch Tables
    await connection.query(`
      CREATE TABLE IF NOT EXISTS branch_tables (
        id INT AUTO_INCREMENT PRIMARY KEY,
        branch_id VARCHAR(100) NOT NULL,
        name VARCHAR(100) NOT NULL,
        location VARCHAR(255),
        status VARCHAR(50) DEFAULT 'Active',
        FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE
      )
    `);
    console.log("- Verified/Created table: branch_tables");

    // 4. Categories Table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id INT AUTO_INCREMENT PRIMARY KEY,
        restaurant_id INT NOT NULL,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        emoji VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
        UNIQUE KEY unique_restaurant_category (restaurant_id, name)
      )
    `);
    console.log("- Verified/Created table: categories");

    // 5. Menu Items Table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS menu_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        restaurant_id INT NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        price DECIMAL(10, 2) NOT NULL,
        image VARCHAR(512),
        category VARCHAR(100) NOT NULL,
        popular BOOLEAN DEFAULT FALSE,
        FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE
      )
    `);
    console.log("- Verified/Created table: menu_items");

    // 6. Users Table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(255) PRIMARY KEY,
        restaurant_id INT NULL,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL,
        assigned_branch_id VARCHAR(100) NULL,
        avatar VARCHAR(512) NULL,
        status VARCHAR(50) DEFAULT 'Active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE SET NULL,
        FOREIGN KEY (assigned_branch_id) REFERENCES branches(id) ON DELETE SET NULL
      )
    `);
    console.log("- Verified/Created table: users");

    // 7. Orders Table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id VARCHAR(100) PRIMARY KEY,
        restaurant_id INT NOT NULL,
        branch_id VARCHAR(100) NOT NULL,
        table_name VARCHAR(100) NOT NULL,
        items JSON NOT NULL,
        status VARCHAR(50) DEFAULT 'Pending',
        total DECIMAL(10, 2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
        FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE
      )
    `);
    console.log("- Verified/Created table: orders");

    // Enable Foreign Key checks again
    await connection.query("SET FOREIGN_KEY_CHECKS = 1");

    console.log("\n[DB] ✅ All tables initialized successfully without seed data!");
  } catch (err) {
    console.error("[DB] ❌ Initialization failed:", err);
  } finally {
    await connection.end();
  }
}

main();
