import mysql from "mysql2/promise";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  const envPath = path.join(__dirname, "..", ".env");
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, "utf8").split("\n");
    lines.forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return;
      const idx = trimmed.indexOf("=");
      if (idx !== -1) {
        const key = trimmed.slice(0, idx).trim();
        let val = trimmed.slice(idx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        process.env[key] = val;
      }
    });
  }
}

loadEnv();

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, salt, 600000, 64, "sha512").toString("hex");
  return `$pbkdf2v2$${salt}:${hash}`;
}

async function run() {
  const conn = await mysql.createConnection({
    host: process.env.MYSQL_HOST || "localhost",
    port: parseInt(process.env.MYSQL_PORT || "3306", 10),
    user: process.env.MYSQL_USER || "root",
    password: process.env.MYSQL_PASSWORD || "",
    database: process.env.MYSQL_DATABASE || "amenuverse",
  });

  const demoAccounts = [
    { email: "admin@menuverse.app", pwd: "admin123" },
    { email: "owner@burgercraft.com", pwd: "owner123" },
    { email: "manager@burgercraft.com", pwd: "manager123" },
    { email: "cashier@burgercraft.com", pwd: "cashier123" },
    { email: "chef@burgercraft.com", pwd: "chef123" },
    { email: "waiter@burgercraft.com", pwd: "waiter123" },
    { email: "host@burgercraft.com", pwd: "host123" },
    { email: "owner@sultansdine.com", pwd: "owner123" },
    { email: "manager@sultansdine.com", pwd: "manager123" },
    { email: "cashier@sultansdine.com", pwd: "cashier123" },
    { email: "chef@sultansdine.com", pwd: "chef123" },
    { email: "waiter@sultansdine.com", pwd: "waiter123" },
    { email: "host@sultansdine.com", pwd: "host123" },
    { email: "manager@bellapizza.com", pwd: "password123" },
    { email: "bellapizza@gmail.com", pwd: "password123" },
  ];

  for (const acc of demoAccounts) {
    const hashed = hashPassword(acc.pwd);
    await conn.execute("UPDATE users SET password_hash = ? WHERE email = ?", [hashed, acc.email]);
    console.log(`Updated ${acc.email} -> ${acc.pwd}`);
  }

  const [testRow] = await conn.execute("SELECT email, password_hash FROM users WHERE email = 'admin@menuverse.app'");
  console.log("Verified Admin:", testRow[0]);

  await conn.end();
}

run().catch(console.error);
