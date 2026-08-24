import mysql from "mysql2/promise";
import crypto from "crypto";

async function createBranchesTable() {
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

    // Create branches table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS branches (
        id VARCHAR(255) PRIMARY KEY,
        restaurant_id INT DEFAULT 1,
        name VARCHAR(255) NOT NULL,
        address TEXT NOT NULL,
        phone VARCHAR(50),
        manager VARCHAR(255),
        status VARCHAR(50) DEFAULT 'open',
        is_default TINYINT(1) DEFAULT 0,
        menu_id VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    console.log("Table 'branches' created / verified!");

    // Disable foreign key checks to refresh seed data
    await connection.query("TRUNCATE TABLE branches");

    const defaultBranches = [
      {
        id: crypto.randomUUID(),
        restaurant_id: 1,
        name: "Dhanmondi Flagship Branch",
        address: "Road 27, Dhanmondi, Dhaka",
        phone: "+880 1712-345678",
        manager: "Tariqul Islam",
        status: "open",
        is_default: 1,
        menu_id: "menu-dhanmondi",
      },
      {
        id: crypto.randomUUID(),
        restaurant_id: 1,
        name: "Gulshan Bistro Branch",
        address: "Gulshan Avenue, Gulshan-2, Dhaka",
        phone: "+880 1812-987654",
        manager: "Sabrina Rahman",
        status: "open",
        is_default: 0,
        menu_id: "menu-gulshan",
      },
      {
        id: crypto.randomUUID(),
        restaurant_id: 1,
        name: "Uttara Express Kitchen",
        address: "Sector 3, Uttara, Dhaka",
        phone: "+880 1912-554433",
        manager: "Rakib Hassan",
        status: "temporarily-closed",
        is_default: 0,
        menu_id: "menu-uttara",
      },
    ];

    for (const b of defaultBranches) {
      await connection.query(
        `INSERT INTO branches (id, restaurant_id, name, address, phone, manager, status, is_default, menu_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          b.id,
          b.restaurant_id,
          b.name,
          b.address,
          b.phone,
          b.manager,
          b.status,
          b.is_default,
          b.menu_id,
        ],
      );
      console.log(`Branch [${b.name}] -> UUID: ${b.id}`);
    }

    console.log("\n🎉 Table 'branches' populated with UUID v4 primary keys in phpMyAdmin!");
    await connection.end();
  } catch (err) {
    console.error("MySQL Error:", err.message);
  }
}

createBranchesTable();
