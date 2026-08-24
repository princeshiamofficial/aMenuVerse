import mysql from "mysql2/promise";
import crypto from "crypto";

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, "sha512").toString("hex");
  return `${salt}:${hash}`;
}

async function createUsersWithUUIDs() {
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

    console.log("Connected to amenuverse!");

    // Create tables if not existing
    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(255) PRIMARY KEY,
        email VARCHAR(255) NOT NULL UNIQUE,
        password_hash VARCHAR(255),
        full_name VARCHAR(255),
        phone VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS user_roles (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        role VARCHAR(100) NOT NULL,
        restaurant_id VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        id VARCHAR(255) PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        expires_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // Disable foreign key checks to truncate/refresh tables
    await connection.query("SET FOREIGN_KEY_CHECKS = 0");
    await connection.query("TRUNCATE TABLE user_roles");
    await connection.query("TRUNCATE TABLE sessions");
    await connection.query("TRUNCATE TABLE users");
    await connection.query("SET FOREIGN_KEY_CHECKS = 1");

    console.log("Truncated old tables for clean UUID generation.");

    const ownerHash = hashPassword("owner123");
    const managerHash = hashPassword("manager123");
    const cashierHash = hashPassword("cashier123");
    const chefHash = hashPassword("chef123");
    const waiterHash = hashPassword("waiter123");
    const hostHash = hashPassword("host123");
    const adminHash = hashPassword("admin123");

    // Seed demo users with deterministic IDs
    const demoUsers = [
      {
        id: "demo-admin-menuverse-app",
        email: "admin@menuverse.app",
        password_hash: adminHash,
        full_name: "System Super Admin",
        phone: "+1 (555) 019-9001",
        role: "super_admin",
        restaurant_id: null,
      },
      // Restaurant 1: Burger Craft Lab
      {
        id: "demo-owner-burgercraft-com",
        email: "owner@burgercraft.com",
        password_hash: ownerHash,
        full_name: "Tariqul Islam (Owner - Burger Craft)",
        phone: "+880 1700-112233",
        role: "owner",
        restaurant_id: "1",
      },
      {
        id: "demo-manager-burgercraft-com",
        email: "manager@burgercraft.com",
        password_hash: managerHash,
        full_name: "Sabrina Rahman (Manager - Burger Craft)",
        phone: "+880 1712-345678",
        role: "manager",
        restaurant_id: "1",
      },
      {
        id: "demo-cashier-burgercraft-com",
        email: "cashier@burgercraft.com",
        password_hash: cashierHash,
        full_name: "Tamanna Akter (Cashier - Burger Craft)",
        phone: "+880 1712-876543",
        role: "cashier",
        restaurant_id: "1",
      },
      {
        id: "demo-chef-burgercraft-com",
        email: "chef@burgercraft.com",
        password_hash: chefHash,
        full_name: "Arif Chowdhury (Chef - Burger Craft)",
        phone: "+880 1712-112233",
        role: "chef",
        restaurant_id: "1",
      },
      {
        id: "demo-waiter-burgercraft-com",
        email: "waiter@burgercraft.com",
        password_hash: waiterHash,
        full_name: "Rakib Hassan (Waiter - Burger Craft)",
        phone: "+880 1712-445566",
        role: "waiter",
        restaurant_id: "1",
      },
      {
        id: "demo-host-burgercraft-com",
        email: "host@burgercraft.com",
        password_hash: hostHash,
        full_name: "Nadia Islam (Host - Burger Craft)",
        phone: "+880 1712-778899",
        role: "host",
        restaurant_id: "1",
      },
      // Restaurant 2: Sultan's Dine
      {
        id: "demo-owner-sultansdine-com",
        email: "owner@sultansdine.com",
        password_hash: ownerHash,
        full_name: "Sultan Mahmud (Owner - Sultan's Dine)",
        phone: "+880 1912-990011",
        role: "owner",
        restaurant_id: "2",
      },
      {
        id: "demo-manager-sultansdine-com",
        email: "manager@sultansdine.com",
        password_hash: managerHash,
        full_name: "Kabir Khan (Manager - Sultan's Dine)",
        phone: "+880 1912-990022",
        role: "manager",
        restaurant_id: "2",
      },
      {
        id: "demo-cashier-sultansdine-com",
        email: "cashier@sultansdine.com",
        password_hash: cashierHash,
        full_name: "Faria Ahmed (Cashier - Sultan's Dine)",
        phone: "+880 1912-990033",
        role: "cashier",
        restaurant_id: "2",
      },
      {
        id: "demo-chef-sultansdine-com",
        email: "chef@sultansdine.com",
        password_hash: chefHash,
        full_name: "Chef Ustad Babul (Chef - Sultan's Dine)",
        phone: "+880 1912-990044",
        role: "chef",
        restaurant_id: "2",
      },
      {
        id: "demo-waiter-sultansdine-com",
        email: "waiter@sultansdine.com",
        password_hash: waiterHash,
        full_name: "Imran Hossain (Waiter - Sultan's Dine)",
        phone: "+880 1912-990055",
        role: "waiter",
        restaurant_id: "2",
      },
      {
        id: "demo-host-sultansdine-com",
        email: "host@sultansdine.com",
        password_hash: hostHash,
        full_name: "Mehnaz Parveen (Host - Sultan's Dine)",
        phone: "+880 1912-990066",
        role: "host",
        restaurant_id: "2",
      },
    ];

    for (const u of demoUsers) {
      await connection.query(
        "INSERT INTO users (id, email, password_hash, full_name, phone) VALUES (?, ?, ?, ?, ?)",
        [u.id, u.email, u.password_hash, u.full_name, u.phone],
      );

      await connection.query(
        "INSERT INTO user_roles (user_id, role, restaurant_id) VALUES (?, ?, ?)",
        [u.id, u.role, u.restaurant_id],
      );

      console.log(`User [${u.email}] -> UUID: ${u.id}`);
    }

    console.log(
      "\n🎉 User database populated with standard UUID v4 IDs! Check phpMyAdmin at http://localhost/phpmyadmin/",
    );
    await connection.end();
  } catch (err) {
    console.error("MySQL Error:", err.message);
  }
}

createUsersWithUUIDs();
