import { createRequire } from "module";
import { fileURLToPath } from "url";
import { dirname } from "path";

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const mysql = require("mysql2/promise");
const bcrypt = require("bcryptjs");
const fs = require("fs");
const path = require("path");

// Helper to manually parse .env.local file
function loadEnv() {
  const envPath = path.join(__dirname, "..", ".env.local");
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, "utf8");
    content.split("\n").forEach((line) => {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let value = match[2] || "";
        // Remove quotes if present
        if (value.startsWith('"') && value.endsWith('"')) {
          value = value.slice(1, -1);
        } else if (value.startsWith("'") && value.endsWith("'")) {
          value = value.slice(1, -1);
        }
        process.env[key] = value.trim();
      }
    });
    console.log("Loaded configurations from .env.local");
  } else {
    console.warn(".env.local not found. Using system environment variables.");
  }
}

loadEnv();

const MYSQL_HOST = process.env.MYSQL_HOST || "localhost";
const MYSQL_PORT = process.env.MYSQL_PORT || 3306;
const MYSQL_USER = process.env.MYSQL_USER || "root";
const MYSQL_PASSWORD = process.env.MYSQL_PASSWORD || "";
const MYSQL_DATABASE = process.env.MYSQL_DATABASE || "digital_food_menu";

// Mock Data structure copied from src/app/data/restaurants.ts
const RESTAURANTS_DATA = [
  {
    id: 1,
    name: "Burger Craft Lab",
    cuisine: "Gourmet Burgers",
    rating: "4.9",
    reviews: "340",
    price: "$$",
    phone: "+8801919-760626",
    operatingHours: "Open Daily: 11:00 AM - 11:30 PM",
    facilities: "Air Conditioned, Wifi, Table QR ordering, bKash payments accepted",
    time: "15-25 min",
    location: "Dhanmondi, Dhaka",
    logo: "B",
    logoBg: "from-amber-500 to-orange-600",
    image:
      "https://images.unsplash.com/photo-1552566626-52f8b828add9?w=800&auto=format&fit=crop&q=80",
    logoImage:
      "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=80&auto=format&fit=crop&q=80",
    username: "burgercraftlab",
    branches: [
      {
        id: "dhanmondi",
        name: "Dhanmondi Branch",
        location: "Dhanmondi, Dhaka",
        phone: "+880 1712-345678",
        operatingHours: "11:00 AM - 11:00 PM",
        tables: [
          { name: "Table 01", location: "Window Side", status: "Active" },
          { name: "Table 02", location: "Window Side", status: "Active" },
          { name: "Table 03", location: "Main Hall", status: "Active" },
          { name: "Table 04", location: "Main Hall", status: "Active" },
          { name: "Table 05", location: "Main Hall", status: "Active" },
          { name: "Table 06", location: "VIP Lounge", status: "Active" },
          { name: "Table 07", location: "VIP Lounge", status: "Active" },
          { name: "Table 08", location: "VIP Lounge", status: "Active" },
        ],
      },
      {
        id: "gulshan",
        name: "Gulshan Branch",
        location: "Gulshan-2, Dhaka",
        phone: "+880 1712-876543",
        operatingHours: "12:00 PM - 12:00 AM",
        tables: [
          { name: "Table 01", location: "Window Side", status: "Active" },
          { name: "Table 02", location: "Terrace", status: "Active" },
          { name: "Table 03", location: "Main Room", status: "Active" },
          { name: "Table 04", location: "Main Room", status: "Active" },
        ],
      },
      {
        id: "uttara",
        name: "Uttara Branch",
        location: "Sector 11, Uttara, Dhaka",
        phone: "+880 1712-112233",
        operatingHours: "11:00 AM - 10:00 PM",
        tables: [
          { name: "Table 01", location: "Ground Floor", status: "Active" },
          { name: "Table 02", location: "Ground Floor", status: "Active" },
          { name: "Table 03", location: "First Floor", status: "Active" },
        ],
      },
    ],
    menuItems: [
      {
        name: "Classic Cheese Burger",
        description:
          "Premium flame-grilled beef patty, melted cheddar cheese, crisp lettuce, ripe tomatoes, and signature house burger sauce.",
        price: 8.5,
        image:
          "https://images.unsplash.com/photo-1550547660-d9450f859349?w=600&auto=format&fit=crop&q=80",
        category: "Burgers",
        popular: true,
      },
      {
        name: "Smoked BBQ Bacon Burger",
        description:
          "Double beef patty, crispy smoked veal bacon, cheddar cheese, golden onion rings, and a drizzle of smoky hickory BBQ sauce.",
        price: 12.5,
        image:
          "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&auto=format&fit=crop&q=80",
        category: "Burgers",
        popular: true,
      },
      {
        name: "Spicy Jalapeno Crunch",
        description:
          "Grilled beef patty, hot fire-roasted jalapenos, pepper jack cheese, crispy fried onions, and spicy jalapeno garlic aioli.",
        price: 10.0,
        image:
          "https://images.unsplash.com/photo-1525059696034-4967a8e1dca2?w=600&auto=format&fit=crop&q=80",
        category: "Burgers",
      },
      {
        name: "Truffle Parmesan Fries",
        description:
          "Golden crispy thin-cut French fries tossed in white truffle oil, grated parmesan cheese, and fresh minced parsley.",
        price: 5.0,
        image:
          "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=600&auto=format&fit=crop&q=80",
        category: "Sides",
      },
      {
        name: "Fresh Mint Lemonade",
        description:
          "Elegantly chilled craft lemonade blended with fresh garden mint leaves and organic brown sugar syrup.",
        price: 3.5,
        image:
          "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=600&auto=format&fit=crop&q=80",
        category: "Beverages",
      },
    ],
  },
  {
    id: 2,
    name: "La Dolce Vita",
    cuisine: "Italian Pasta & Pizza",
    rating: "4.8",
    reviews: "520",
    price: "$$$",
    time: "25-35 min",
    location: "Gulshan, Dhaka",
    logo: "L",
    logoBg: "from-red-500 to-rose-600",
    image:
      "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&auto=format&fit=crop&q=80",
    logoImage:
      "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=80&auto=format&fit=crop&q=80",
    username: "ladolcevita",
    branches: [
      {
        id: "ladolce_gulshan",
        name: "La Dolce Gulshan",
        location: "Gulshan, Dhaka",
        phone: "+880 1712-445566",
        operatingHours: "12:00 PM - 11:00 PM",
        tables: [
          { name: "Table 01", location: "Main Hall", status: "Active" },
          { name: "Table 02", location: "Main Hall", status: "Active" },
        ],
      },
    ],
    menuItems: [
      {
        name: "Truffle Mushroom Pizza",
        description:
          "Stone-baked Neapolitan pizza topped with wild cremini mushrooms, white truffle oil essence, fresh mozzarella, and wild arugula.",
        price: 18.0,
        image:
          "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=600&auto=format&fit=crop&q=80",
        category: "Pizza",
        popular: true,
      },
      {
        name: "Spaghetti Carbonara",
        description:
          "Traditional egg yolk emulsion sauce, crispy cured pancetta, aged Pecorino Romano cheese, and fresh cracked black peppercorns.",
        price: 15.5,
        image:
          "https://images.unsplash.com/photo-1612874742237-6526221588e3?w=600&auto=format&fit=crop&q=80",
        category: "Pasta",
        popular: true,
      },
      {
        name: "Classic Margherita Pizza",
        description:
          "Rich San Marzano tomato base, fresh buffalo mozzarella, aromatic sweet basil leaves, and extra virgin olive oil drizzle.",
        price: 14.0,
        image:
          "https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?w=600&auto=format&fit=crop&q=80",
        category: "Pizza",
      },
      {
        name: "Espresso Tiramisu",
        description:
          "Layers of espresso-soaked Italian ladyfingers, velvety whipped mascarpone cream cheese, and dark cocoa powder dusting.",
        price: 7.5,
        image:
          "https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?w=600&auto=format&fit=crop&q=80",
        category: "Desserts",
      },
      {
        name: "Chianti Classico",
        description:
          "A glass of premium Tuscan red wine featuring rich cherry and wild berry notes with smooth tannins.",
        price: 9.0,
        image:
          "https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=600&auto=format&fit=crop&q=80",
        category: "Beverages",
      },
    ],
  },
  {
    id: 3,
    name: "Sakura Sushi Bar",
    cuisine: "Japanese Sushi & Ramen",
    rating: "5.0",
    reviews: "1.2k",
    price: "$$$",
    time: "20-30 min",
    location: "Banani, Dhaka",
    logo: "S",
    logoBg: "from-pink-500 to-purple-600",
    image:
      "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&auto=format&fit=crop&q=80",
    logoImage:
      "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=80&auto=format&fit=crop&q=80",
    username: "sakurasushibar",
    branches: [
      {
        id: "sakura_banani",
        name: "Sakura Banani",
        location: "Banani, Dhaka",
        phone: "+880 1712-998877",
        operatingHours: "12:00 PM - 11:30 PM",
        tables: [
          { name: "Table 01", location: "Sushi Counter", status: "Active" },
          { name: "Table 02", location: "Main Area", status: "Active" },
        ],
      },
    ],
    menuItems: [
      {
        name: "Dragon Sushi Roll Platter",
        description:
          "Inside-out sushi rolls filled with freshwater eel and cucumber, topped with avocado sheets, tobiko, and sweet soy glaze.",
        price: 22.5,
        image:
          "https://images.unsplash.com/photo-1611143669185-af224c5e3252?w=600&auto=format&fit=crop&q=80",
        category: "Sushi",
        popular: true,
      },
      {
        name: "Tonkotsu Chashu Ramen",
        description:
          "16-hour slow-cooked creamy pork bone broth, custom noodles, tender braised chashu pork, soft nitamago egg, and nori.",
        price: 16.0,
        image:
          "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=600&auto=format&fit=crop&q=80",
        category: "Ramen",
        popular: true,
      },
      {
        name: "Spicy Bluefin Tuna Roll",
        description:
          "Hand-rolled sushi featuring spicy minced bluefin tuna, toasted sesame seeds, crunchy tempura flakes, and spicy kewpie.",
        price: 12.0,
        image:
          "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=600&auto=format&fit=crop&q=80",
        category: "Sushi",
      },
      {
        name: "Uji Matcha Ice Cream",
        description:
          "Artisanal churned green tea ice cream made with premium stone-ground matcha powder from Uji, Kyoto.",
        price: 5.5,
        image:
          "https://images.unsplash.com/photo-1505394033641-40c6ad1178d7?w=600&auto=format&fit=crop&q=80",
        category: "Desserts",
      },
      {
        name: "Warm Junmai Sake",
        description:
          "Traditional pure-rice sake served warm, presenting a rich, full-bodied flavour profile with clean notes.",
        price: 10.0,
        image:
          "https://images.unsplash.com/photo-1613063372218-568d6020bc41?w=600&auto=format&fit=crop&q=80",
        category: "Beverages",
      },
    ],
  },
  {
    id: 4,
    name: "The Spicy Wok",
    cuisine: "Sichuan & Asian Fusion",
    rating: "4.7",
    reviews: "180",
    price: "$$",
    time: "15-25 min",
    location: "Uttara, Dhaka",
    logo: "T",
    logoBg: "from-red-600 to-orange-500",
    image:
      "https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=800&auto=format&fit=crop&q=80",
    logoImage:
      "https://images.unsplash.com/photo-1512058564366-18510be2db19?w=80&auto=format&fit=crop&q=80",
    username: "thespicywok",
    branches: [
      {
        id: "spicywok_uttara",
        name: "Spicy Wok Uttara",
        location: "Uttara, Dhaka",
        phone: "+880 1712-443322",
        operatingHours: "11:30 AM - 10:30 PM",
        tables: [{ name: "Table 01", location: "Main Room", status: "Active" }],
      },
    ],
    menuItems: [
      {
        name: "Spicy Sichuan Chilli Wontons",
        description:
          "Delicate steamed pork wontons served floating in a spicy, aromatic house chilli oil and aged black vinegar sauce.",
        price: 11.0,
        image:
          "https://images.unsplash.com/photo-1563245372-f21724e3856d?w=600&auto=format&fit=crop&q=80",
        category: "Appetizers",
        popular: true,
      },
      {
        name: "Sichuan Kung Pao Chicken",
        description:
          "Stir-fried tender diced chicken breast, roasted peanuts, wok-charred dry red chillies, and aromatic Sichuan peppercorns.",
        price: 14.5,
        image:
          "https://images.unsplash.com/photo-1525755662778-989d0524087e?w=600&auto=format&fit=crop&q=80",
        category: "Mains",
        popular: true,
      },
      {
        name: "Authentic Mapo Tofu",
        description:
          "Silken tofu blocks cooked with seasoned minced beef in a fiery, numbing Sichuan bean paste sauce.",
        price: 13.0,
        image:
          "https://images.unsplash.com/photo-1541832676-9b763b0239ab?w=600&auto=format&fit=crop&q=80",
        category: "Mains",
      },
      {
        name: "Steamed Jasmine Rice",
        description:
          "Fragrant, fluffy long-grain steamed Jasmine rice served in a traditional porcelain bowl.",
        price: 2.5,
        image:
          "https://images.unsplash.com/photo-1516685018646-549198525c1b?w=600&auto=format&fit=crop&q=80",
        category: "Sides",
      },
      {
        name: "Brewed Jasmine Green Tea",
        description:
          "Freshly brewed hot loose-leaf Jasmine green tea served hot, showcasing delicate floral notes.",
        price: 3.0,
        image:
          "https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=600&auto=format&fit=crop&q=80",
        category: "Beverages",
      },
    ],
  },
  {
    id: 5,
    name: "Red Chili Chinese Restaurant",
    cuisine: "Sichuan & Cantonese Chinese",
    rating: "4.8",
    reviews: "210",
    price: "$$",
    time: "20-30 min",
    location: "Dhanmondi, Dhaka",
    logo: "R",
    logoBg: "from-red-600 to-orange-700",
    image:
      "https://images.unsplash.com/photo-1563245372-f21724e3856d?w=800&auto=format&fit=crop&q=80",
    logoImage:
      "https://images.unsplash.com/photo-1512058564366-18510be2db19?w=80&auto=format&fit=crop&q=80",
    username: "redchilichinese",
    branches: [
      {
        id: "redchili_dhanmondi",
        name: "Red Chili Dhanmondi",
        location: "Dhanmondi, Dhaka",
        phone: "+880 1712-556677",
        operatingHours: "11:00 AM - 11:00 PM",
        tables: [{ name: "Table 01", location: "Main Hall", status: "Active" }],
      },
    ],
    menuItems: [
      {
        name: "Sichuan Chili Chicken",
        description:
          "Crispy chicken cubes stir-fried with hot Sichuan peppercorns, dried red chilis, and fresh garlic.",
        price: 13.5,
        image:
          "https://images.unsplash.com/photo-1525755662778-989d0524087e?w=600&auto=format&fit=crop&q=80",
        category: "Mains",
        popular: true,
      },
      {
        name: "Beef with Oyster Sauce",
        description:
          "Tender beef slices stir-fried with fresh broccoli, mushrooms, and scallions in rich oyster sauce.",
        price: 15.0,
        image:
          "https://images.unsplash.com/photo-1534939561126-855b8675edd7?w=600&auto=format&fit=crop&q=80",
        category: "Mains",
        popular: true,
      },
      {
        name: "Yangzhou Fried Rice",
        description:
          "Classic wok-fried Jasmine rice with shrimps, barbecue pork, green peas, and egg.",
        price: 10.0,
        image:
          "https://images.unsplash.com/photo-1512058564366-18510be2db19?w=600&auto=format&fit=crop&q=80",
        category: "Rice & Noodles",
      },
      {
        name: "Steamed Chicken Dumplings",
        description:
          "Handmade dumplings filled with seasoned minced chicken, served with soy dipping sauce.",
        price: 8.0,
        image:
          "https://images.unsplash.com/photo-1563245372-f21724e3856d?w=600&auto=format&fit=crop&q=80",
        category: "Appetizers",
      },
      {
        name: "Iced Lychee Tea",
        description:
          "Sweet iced black tea infused with fragrant lychee fruit syrup and whole lychees.",
        price: 3.5,
        image:
          "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=600&auto=format&fit=crop&q=80",
        category: "Beverages",
      },
    ],
  },
];

async function main() {
  const connection = await mysql.createConnection({
    host: MYSQL_HOST,
    port: parseInt(MYSQL_PORT.toString(), 10),
    user: MYSQL_USER,
    password: MYSQL_PASSWORD,
  });

  console.log("Connected to MySQL server.");

  // Create database
  await connection.query(`CREATE DATABASE IF NOT EXISTS \`${MYSQL_DATABASE}\``);
  await connection.query(`USE \`${MYSQL_DATABASE}\``);
  console.log(`Database "${MYSQL_DATABASE}" created or selected.`);

  // Load and execute schema
  const schemaPath = path.join(__dirname, "schema.sql");
  const schemaSql = fs.readFileSync(schemaPath, "utf8");

  // Split queries by semicolon (simple splitter, assuming no semicolon inside strings)
  const queries = schemaSql
    .split(";")
    .map((q) => q.trim())
    .filter((q) => q.length > 0);

  for (const sql of queries) {
    await connection.query(sql);
  }
  console.log("Database schema successfully initialized.");

  // Clear existing records before seeding (order is important due to foreign keys)
  console.log("Clearing old tables data...");
  await connection.query("SET FOREIGN_KEY_CHECKS = 0");
  await connection.query("TRUNCATE TABLE orders");
  await connection.query("TRUNCATE TABLE users");
  await connection.query("TRUNCATE TABLE menu_items");
  await connection.query("TRUNCATE TABLE categories");
  await connection.query("TRUNCATE TABLE branch_tables");
  await connection.query("TRUNCATE TABLE branches");
  await connection.query("TRUNCATE TABLE restaurants");
  await connection.query("SET FOREIGN_KEY_CHECKS = 1");
  console.log("Tables cleared.");

  // Password Hash helper
  const saltRounds = 10;
  const hashPassword = async (password) => {
    return await bcrypt.hash(password, saltRounds);
  };

  // Seed data
  console.log("Inserting seed records...");

  for (const r of RESTAURANTS_DATA) {
    await connection.query(
      `INSERT INTO restaurants 
       (id, name, cuisine, rating, reviews, price, time, location, logo, logo_bg, image, logo_image, username, phone, operating_hours, facilities) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        r.id,
        r.name,
        r.cuisine,
        r.rating,
        r.reviews,
        r.price,
        r.time,
        r.location,
        r.logo,
        r.logoBg,
        r.image,
        r.logoImage,
        r.username,
        r.phone || null,
        r.operatingHours || null,
        r.facilities || null,
      ],
    );
    const restaurantId = r.id;

    console.log(`- Seeded restaurant: ${r.name} (ID: ${restaurantId})`);

    // Seed Branches
    if (r.branches) {
      for (const b of r.branches) {
        await connection.query(
          `INSERT INTO branches (id, restaurant_id, name, location, phone, operating_hours) VALUES (?, ?, ?, ?, ?, ?)`,
          [b.id, restaurantId, b.name, b.location, b.phone, b.operatingHours],
        );

        // Seed Tables inside Branch
        if (b.tables) {
          for (const t of b.tables) {
            await connection.query(
              `INSERT INTO branch_tables (branch_id, name, location, status) VALUES (?, ?, ?, ?)`,
              [b.id, t.name, t.location, t.status],
            );
          }
        }
      }
    }

    // Seed Categories
    const categoriesSet = new Set();
    for (const m of r.menuItems) {
      categoriesSet.add(m.category);
    }

    for (const catName of categoriesSet) {
      const getCategoryAppleEmojiName = (category) => {
        const map = {
          burgers: "hamburger",
          sides: "french-fries",
          beverages: "cup-with-straw",
          pizza: "pizza",
          pasta: "spaghetti",
          desserts: "shortcake",
          sushi: "sushi",
          ramen: "steaming-bowl",
          appetizers: "dumpling",
          mains: "pot-of-food",
          "rice & noodles": "curry-rice",
        };
        return map[category.trim().toLowerCase()] || "sparkles";
      };

      await connection.query(
        `INSERT INTO categories (restaurant_id, name, description, emoji) VALUES (?, ?, ?, ?)`,
        [
          restaurantId,
          catName,
          `${catName} menu category for ${r.name}`,
          getCategoryAppleEmojiName(catName),
        ],
      );
    }

    // Seed Menu Items
    for (const m of r.menuItems) {
      await connection.query(
        `INSERT INTO menu_items (restaurant_id, name, description, price, image, category, popular) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [restaurantId, m.name, m.description, m.price, m.image, m.category, m.popular ? 1 : 0],
      );
    }
  }

  // Seed Users (Staff & Admins)
  const defaultPassword = "password123";
  const hashedPw = await hashPassword(defaultPassword);

  const defaultUsers = [
    // Burger Craft Lab (ID 1)
    {
      name: "Color Hut Admin",
      email: "admin@example.com",
      passwordHash: hashedPw,
      role: "admin",
      restaurantId: 1,
      assignedBranchId: null,
      avatar: null,
    },
    {
      name: "Color Hut Demo",
      email: "demo@example.com",
      passwordHash: hashedPw,
      role: "admin",
      restaurantId: 1,
      assignedBranchId: null,
      avatar: "https://app.colorhutbd.xyz/uploads/622b5802-76a5-4f36-b1b6-75d7fad02c94.png",
    },
    {
      name: "Dhanmondi Manager",
      email: "dhanmondi@example.com",
      passwordHash: hashedPw,
      role: "manager",
      restaurantId: 1,
      assignedBranchId: "dhanmondi",
      avatar: null,
    },
    {
      name: "Gulshan Manager",
      email: "gulshan@example.com",
      passwordHash: hashedPw,
      role: "manager",
      restaurantId: 1,
      assignedBranchId: "gulshan",
      avatar: null,
    },
    {
      name: "Uttara Manager",
      email: "uttara@example.com",
      passwordHash: hashedPw,
      role: "manager",
      restaurantId: 1,
      assignedBranchId: "uttara",
      avatar: null,
    },

    // La Dolce Vita (ID 2)
    {
      name: "La Dolce Admin",
      email: "ladolcevita@example.com",
      passwordHash: hashedPw,
      role: "admin",
      restaurantId: 2,
      assignedBranchId: null,
      avatar: null,
    },

    // Sakura Sushi Bar (ID 3)
    {
      name: "Sakura Admin",
      email: "sakura@example.com",
      passwordHash: hashedPw,
      role: "admin",
      restaurantId: 3,
      assignedBranchId: null,
      avatar: null,
    },

    // The Spicy Wok (ID 4)
    {
      name: "Spicy Wok Admin",
      email: "spicywok@example.com",
      passwordHash: hashedPw,
      role: "admin",
      restaurantId: 4,
      assignedBranchId: null,
      avatar: null,
    },

    // Red Chili Chinese Restaurant (ID 5)
    {
      name: "Red Chili Admin",
      email: "redchili@example.com",
      passwordHash: hashedPw,
      role: "admin",
      restaurantId: 5,
      assignedBranchId: null,
      avatar: null,
    },
  ];

  for (const u of defaultUsers) {
    await connection.query(
      `INSERT INTO users (restaurant_id, name, email, password_hash, role, assigned_branch_id, avatar, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        u.restaurantId,
        u.name,
        u.email,
        u.passwordHash,
        u.role,
        u.assignedBranchId,
        u.avatar,
        u.status || "Active",
      ],
    );
    console.log(`- Seeded user: ${u.email} (${u.role})`);
  }

  // Seed some initial orders for testing (Burger Craft Lab - dhanmondi)
  const initialOrders = [
    {
      id: "ORD-1001",
      restaurantId: 1,
      branchId: "dhanmondi",
      tableName: "Table 01",
      items: JSON.stringify([
        { name: "Classic Cheese Burger", quantity: 2, price: 8.5 },
        { name: "Truffle Parmesan Fries", quantity: 1, price: 5.0 },
      ]),
      status: "Pending",
      total: 22.0,
    },
    {
      id: "ORD-1002",
      restaurantId: 1,
      branchId: "dhanmondi",
      tableName: "Table 03",
      items: JSON.stringify([
        { name: "Smoked BBQ Bacon Burger", quantity: 1, price: 12.5 },
        { name: "Fresh Mint Lemonade", quantity: 2, price: 3.5 },
      ]),
      status: "Preparing",
      total: 19.5,
    },
  ];

  for (const o of initialOrders) {
    await connection.query(
      `INSERT INTO orders (id, restaurant_id, branch_id, table_name, items, status, total) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [o.id, o.restaurantId, o.branchId, o.tableName, o.items, o.status, o.total],
    );
  }
  console.log("Seeded sample orders.");

  await connection.end();
  console.log("Database seeding successfully finished!");
}

main().catch((err) => {
  console.error("Error seeding database:", err);
  process.exit(1);
});
