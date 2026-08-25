import { createRequire } from "module";
import { fileURLToPath } from "url";
import { dirname } from "path";

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const mysql = require("mysql2/promise");
const crypto = require("crypto");
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
}

loadEnv();

const MYSQL_HOST = process.env.MYSQL_HOST || "localhost";
const MYSQL_PORT = parseInt(process.env.MYSQL_PORT || "3306", 10);
const MYSQL_USER = process.env.MYSQL_USER || "root";
const MYSQL_PASSWORD = process.env.MYSQL_PASSWORD || "";
const MYSQL_DATABASE = process.env.MYSQL_DATABASE || "digital_food_menu";

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, salt, 600000, 64, "sha512").toString("hex");
  return `$pbkdf2v2$${salt}:${hash}`;
}

async function main() {
  console.log(`Connecting to database: ${MYSQL_DATABASE}...`);
  const connection = await mysql.createConnection({
    host: MYSQL_HOST,
    port: MYSQL_PORT,
    user: MYSQL_USER,
    password: MYSQL_PASSWORD,
    database: MYSQL_DATABASE,
  });

  try {
    // 1. Create all 5 default Restaurants so all public URLs work
    const restaurantsData = [
      {
        name: "Burger Craft Lab",
        cuisine: "Gourmet Burgers",
        rating: "4.9",
        reviews: "340",
        price: "$$",
        time: "15-25 min",
        location: "Dhanmondi, Dhaka",
        logo: "B",
        logo_bg: "from-amber-500 to-orange-600",
        username: "burgercraftlab",
        primary_color: "#ff7a00",
        font_family: "Outfit",
        layout_type: "grid",
        branch: {
          id: "dhanmondi-branch",
          name: "Dhanmondi Branch",
          location: "Dhanmondi, Dhaka",
          phone: "+8801919-760626",
          operating_hours: "Open Daily: 11:00 AM - 11:30 PM",
        },
      },
      {
        name: "La Dolce Vita",
        cuisine: "Italian & Pizza",
        rating: "4.7",
        reviews: "180",
        price: "$$$",
        time: "25-35 min",
        location: "Gulshan, Dhaka",
        logo: "L",
        logo_bg: "from-emerald-500 to-teal-600",
        username: "ladolcevita",
        primary_color: "#10b981",
        font_family: "Outfit",
        layout_type: "grid",
        branch: {
          id: "gulshan-branch",
          name: "Gulshan Branch",
          location: "Gulshan, Dhaka",
          phone: "+8801700000001",
          operating_hours: "Open Daily: 12:00 PM - 11:00 PM",
        },
      },
      {
        name: "Sakura Sushi Bar",
        cuisine: "Japanese & Sushi",
        rating: "4.8",
        reviews: "120",
        price: "$$$",
        time: "20-30 min",
        location: "Banani, Dhaka",
        logo: "S",
        logo_bg: "from-pink-500 to-rose-600",
        username: "sakurasushibar",
        primary_color: "#e11d48",
        font_family: "Outfit",
        layout_type: "grid",
        branch: {
          id: "banani-branch",
          name: "Banani Main Branch",
          location: "Road 11, Banani, Dhaka",
          phone: "+8801700000000",
          operating_hours: "Open Daily: 12:00 PM - 10:30 PM",
        },
      },
      {
        name: "The Spicy Wok",
        cuisine: "Pan-Asian & Bowls",
        rating: "4.6",
        reviews: "95",
        price: "$$",
        time: "15-20 min",
        location: "Uttara, Dhaka",
        logo: "W",
        logo_bg: "from-red-500 to-orange-600",
        username: "spicywok",
        primary_color: "#ef4444",
        font_family: "Outfit",
        layout_type: "grid",
        branch: {
          id: "uttara-branch",
          name: "Uttara Branch",
          location: "Uttara, Dhaka",
          phone: "+8801700000002",
          operating_hours: "Open Daily: 11:30 AM - 10:00 PM",
        },
      },
      {
        name: "Red Chili",
        cuisine: "Chinese & Hotpot",
        rating: "4.5",
        reviews: "75",
        price: "$$",
        time: "20-30 min",
        location: "Mirpur, Dhaka",
        logo: "R",
        logo_bg: "from-red-600 to-rose-700",
        username: "redchili",
        primary_color: "#dc2626",
        font_family: "Outfit",
        layout_type: "grid",
        branch: {
          id: "mirpur-branch",
          name: "Mirpur Branch",
          location: "Mirpur, Dhaka",
          phone: "+8801700000003",
          operating_hours: "Open Daily: 11:30 AM - 10:30 PM",
        },
      },
    ];

    let burgerCraftLabId = 1;

    for (const r of restaurantsData) {
      console.log(`Creating/Verifying restaurant: ${r.name}...`);
      const [res] = await connection.query(
        `INSERT INTO restaurants (name, cuisine, rating, reviews, price, time, location, logo, logo_bg, username, primary_color, font_family, layout_type)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)`,
        [
          r.name,
          r.cuisine,
          r.rating,
          r.reviews,
          r.price,
          r.time,
          r.location,
          r.logo,
          r.logo_bg,
          r.username,
          r.primary_color,
          r.font_family,
          r.layout_type,
        ],
      );

      const rId = res.insertId || 1;
      if (r.username === "burgercraftlab") {
        burgerCraftLabId = rId;
      }

      // Create branch
      await connection.query(
        `INSERT INTO branches (id, restaurant_id, name, location, phone, operating_hours)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE id=id`,
        [
          r.branch.id,
          rId,
          r.branch.name,
          r.branch.location,
          r.branch.phone,
          r.branch.operating_hours,
        ],
      );
    }

    // Ensure users.id column is VARCHAR(255) to support string UUIDs / demo IDs
    try {
      await connection.query("ALTER TABLE users MODIFY COLUMN id VARCHAR(255) NOT NULL");
    } catch (e) {
      /* ignore if already VARCHAR */
    }

    // 2. Create Admin Users for all restaurants
    const defaultPassword = "password123";
    const defaultHashedPassword = hashPassword(defaultPassword);

    // Fetch all inserted restaurants to get their IDs and usernames
    const [insertedRestaurants] = await connection.query(
      "SELECT id, name, username FROM restaurants",
    );

    console.log("\nCreating Admin Users for all restaurants...");
    for (const r of insertedRestaurants) {
      let email;
      if (r.username === "burgercraftlab") {
        email = "admin@example.com";
      } else if (r.username === "sakurasushibar") {
        email = "sakura@example.com";
      } else {
        email = `${r.username}@example.com`;
      }

      const userId = `admin-${r.username}`;
      await connection.query(
        `INSERT INTO users (id, restaurant_id, name, email, password_hash, role, assigned_branch_id, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE restaurant_id=VALUES(restaurant_id), password_hash=VALUES(password_hash)`,
        [userId, r.id, `${r.name} Admin`, email, defaultHashedPassword, "admin", null, "Active"],
      );

      // Seed user_roles entry
      await connection.query(
        `INSERT INTO user_roles (user_id, role, restaurant_id)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE role=VALUES(role), restaurant_id=VALUES(restaurant_id)`,
        [userId, "admin", r.id],
      );
      console.log(`- Created admin: ${email} (for ${r.name})`);
    }

    // 3. Create UI Quick Demo Accounts
    const demoAccounts = [
      { id: "demo-admin-menuverse-app", email: "admin@menuverse.app", pwd: "admin123", name: "System Super Admin", role: "super_admin", restId: 0, branch: null },
      { id: "demo-owner-burgercraft-com", email: "owner@burgercraft.com", pwd: "owner123", name: "Tariqul Islam (Owner - Burger Craft)", role: "owner", restId: burgerCraftLabId, branch: "dhanmondi-branch" },
      { id: "demo-manager-burgercraft-com", email: "manager@burgercraft.com", pwd: "manager123", name: "Sabrina Rahman (Manager - Burger Craft)", role: "manager", restId: burgerCraftLabId, branch: "dhanmondi-branch" },
      { id: "demo-cashier-burgercraft-com", email: "cashier@burgercraft.com", pwd: "cashier123", name: "Tamanna Akter (Cashier - Burger Craft)", role: "cashier", restId: burgerCraftLabId, branch: "dhanmondi-branch" },
      { id: "demo-chef-burgercraft-com", email: "chef@burgercraft.com", pwd: "chef123", name: "Arif Chowdhury (Chef - Burger Craft)", role: "chef", restId: burgerCraftLabId, branch: "dhanmondi-branch" },
      { id: "demo-waiter-burgercraft-com", email: "waiter@burgercraft.com", pwd: "waiter123", name: "Rakib Hassan (Waiter - Burger Craft)", role: "waiter", restId: burgerCraftLabId, branch: "dhanmondi-branch" },
      { id: "demo-host-burgercraft-com", email: "host@burgercraft.com", pwd: "host123", name: "Nadia Islam (Host - Burger Craft)", role: "host", restId: burgerCraftLabId, branch: "dhanmondi-branch" },
    ];

    console.log("\nCreating Quick Demo Accounts...");
    for (const demo of demoAccounts) {
      const hashedDemoPwd = hashPassword(demo.pwd);
      await connection.query(
        `INSERT INTO users (id, restaurant_id, name, email, password_hash, role, assigned_branch_id, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'Active')
         ON DUPLICATE KEY UPDATE password_hash=VALUES(password_hash), role=VALUES(role), restaurant_id=VALUES(restaurant_id)`,
        [demo.id, demo.restId === 0 ? null : demo.restId, demo.name, demo.email, hashedDemoPwd, demo.role, demo.branch],
      );

      await connection.query(
        `INSERT INTO user_roles (user_id, role, restaurant_id)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE role=VALUES(role), restaurant_id=VALUES(restaurant_id)`,
        [demo.id, demo.role, demo.restId || 0],
      );
      console.log(`- Created demo account: ${demo.email} (Password: ${demo.pwd})`);
    }

    console.log(`\n✅ Admin and Quick Demo users successfully created!`);
    console.log(`-----------------------------------------------`);
    console.log(`Quick Demo Buttons on Auth Page:`);
    console.log(`  - owner@burgercraft.com (Pass: owner123)`);
    console.log(`  - manager@burgercraft.com (Pass: manager123)`);
    console.log(`  - cashier@burgercraft.com (Pass: cashier123)`);
    console.log(`  - chef@burgercraft.com (Pass: chef123)`);
    console.log(`  - waiter@burgercraft.com (Pass: waiter123)`);
    console.log(`  - host@burgercraft.com (Pass: host123)`);
    console.log(`  - admin@menuverse.app (Pass: admin123)`);
    console.log(`  - admin@example.com (Pass: password123)`);
    console.log(`-----------------------------------------------`);
  } catch (err) {
    console.error("Error bootstrapping admin user:", err);
  } finally {
    await connection.end();
  }
}

main();
