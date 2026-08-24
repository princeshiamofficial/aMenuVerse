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
}

loadEnv();

const MYSQL_HOST = process.env.MYSQL_HOST || "localhost";
const MYSQL_PORT = parseInt(process.env.MYSQL_PORT || "3306", 10);
const MYSQL_USER = process.env.MYSQL_USER || "root";
const MYSQL_PASSWORD = process.env.MYSQL_PASSWORD || "";
const MYSQL_DATABASE = process.env.MYSQL_DATABASE || "digital_food_menu";

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
    // 1. Find Sakura Sushi Bar Restaurant ID
    const [restaurants] = await connection.query("SELECT id FROM restaurants WHERE username = ?", [
      "sakurasushibar",
    ]);

    if (restaurants.length === 0) {
      console.error(
        "❌ Sakura Sushi Bar restaurant not found in the database. Please run create-admin.js first.",
      );
      process.exit(1);
    }

    const restaurantId = restaurants[0].id;
    console.log(`Found Sakura Sushi Bar with ID: ${restaurantId}`);

    // 2. Insert Categories
    const categories = [
      { name: "Sushi", description: "Fresh rolls and nigiri", emoji: "sushi" },
      { name: "Ramen", description: "Warm and comforting noodle soups", emoji: "steaming-bowl" },
      { name: "Desserts", description: "Sweet treats", emoji: "shortcake" },
      { name: "Beverages", description: "Drinks and sake", emoji: "cup-with-straw" },
    ];

    console.log("\nInserting categories...");
    for (const cat of categories) {
      await connection.query(
        `INSERT INTO categories (restaurant_id, name, description, emoji)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE description=VALUES(description), emoji=VALUES(emoji)`,
        [restaurantId, cat.name, cat.description, cat.emoji],
      );
      console.log(`- Seeded category: ${cat.name}`);
    }

    // 3. Insert Menu Items
    const menuItems = [
      {
        name: "Dragon Sushi Roll Platter",
        description:
          "Inside-out sushi rolls filled with freshwater eel and cucumber, topped with avocado sheets, tobiko, and sweet soy glaze.",
        price: 22.5,
        image:
          "https://images.unsplash.com/photo-1611143669185-af224c5e3252?w=600&auto=format&fit=crop&q=80",
        category: "Sushi",
        popular: 1,
      },
      {
        name: "Tonkotsu Chashu Ramen",
        description:
          "16-hour slow-cooked creamy pork bone broth, custom noodles, tender braised chashu pork, soft nitamago egg, and nori.",
        price: 16.0,
        image:
          "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=600&auto=format&fit=crop&q=80",
        category: "Ramen",
        popular: 1,
      },
      {
        name: "Spicy Bluefin Tuna Roll",
        description:
          "Hand-rolled sushi featuring spicy minced bluefin tuna, toasted sesame seeds, crunchy tempura flakes, and spicy kewpie.",
        price: 12.0,
        image:
          "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=600&auto=format&fit=crop&q=80",
        category: "Sushi",
        popular: 0,
      },
      {
        name: "Uji Matcha Ice Cream",
        description:
          "Artisanal churned green tea ice cream made with premium stone-ground matcha powder from Uji, Kyoto.",
        price: 5.5,
        image:
          "https://images.unsplash.com/photo-1505394033641-40c6ad1178d7?w=600&auto=format&fit=crop&q=80",
        category: "Desserts",
        popular: 0,
      },
      {
        name: "Warm Junmai Sake",
        description:
          "Traditional pure-rice sake served warm, presenting a rich, full-bodied flavour profile with clean notes.",
        price: 10.0,
        image:
          "https://images.unsplash.com/photo-1613063372218-568d6020bc41?w=600&auto=format&fit=crop&q=80",
        category: "Beverages",
        popular: 0,
      },
    ];

    console.log("\nInserting menu items...");
    for (const item of menuItems) {
      // Clear existing menu items with same name to avoid duplicates during test runs
      await connection.query("DELETE FROM menu_items WHERE restaurant_id = ? AND name = ?", [
        restaurantId,
        item.name,
      ]);

      await connection.query(
        `INSERT INTO menu_items (restaurant_id, name, description, price, image, category, popular)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          restaurantId,
          item.name,
          item.description,
          item.price,
          item.image,
          item.category,
          item.popular,
        ],
      );
      console.log(`- Seeded menu item: ${item.name}`);
    }

    console.log("\n✅ Sakura Sushi Bar seeded successfully with categories and menu items!");
  } catch (err) {
    console.error("Error seeding Sakura Sushi Bar:", err);
  } finally {
    await connection.end();
  }
}

main();
