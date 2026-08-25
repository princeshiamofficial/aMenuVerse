import pool from "./db";

let initialized = false;

export async function initDb(): Promise<void> {
  if (initialized) return;
  initialized = true;

  const conn = await pool.getConnection();
  try {
    // Ensure FK checks are off during creation to avoid order issues
    await conn.query("SET FOREIGN_KEY_CHECKS = 0");

    // 1. Restaurants (Tenants)
    await conn.query(`
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

    // 2. Branches
    await conn.query(`
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

    // 3. Branch Tables
    await conn.query(`
      CREATE TABLE IF NOT EXISTS branch_tables (
        id INT AUTO_INCREMENT PRIMARY KEY,
        branch_id VARCHAR(100) NOT NULL,
        name VARCHAR(100) NOT NULL,
        location VARCHAR(255),
        status VARCHAR(50) DEFAULT 'Active',
        FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE
      )
    `);

    // 4. Categories
    await conn.query(`
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

    // 5. Menu Items
    await conn.query(`
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

    // 6. Users (Staff / Admins)
    await conn.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
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

    // 7. Orders
    await conn.query(`
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

    await conn.query("SET FOREIGN_KEY_CHECKS = 1");

    console.log("[DB] ✅ All tables verified / created successfully.");
  } catch (err) {
    console.error("[DB] ❌ Failed to initialize database tables:", err);
    throw err;
  } finally {
    conn.release();
  }
}
