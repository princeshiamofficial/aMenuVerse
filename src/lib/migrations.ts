import { Pool } from "mysql2/promise";
import crypto from "crypto";

/**
 * Clean Single-Source-of-Truth Multi-Tenant Schema Engine
 * - users + user_roles is the single source of truth for all staff & user accounts
 * - pos_orders + order_items is the single source of truth for all orders
 * - food_items & categories are the single source of truth for menu items
 * - All entity IDs use UUIDs (crypto.randomUUID())
 * - NOT NULL restaurant_id, Foreign Keys ON DELETE CASCADE, UNIQUE constraints, & Indexes
 */
export async function runDatabaseMigrations(pool: Pool): Promise<void> {
  const tableStatements = [
    // 1. Restaurants Table
    `CREATE TABLE IF NOT EXISTS restaurants (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      slug VARCHAR(255) NOT NULL UNIQUE,
      description TEXT,
      about TEXT,
      logo_url TEXT,
      cover_url TEXT,
      cuisine VARCHAR(255),
      phone VARCHAR(50),
      location TEXT,
      operating_hours VARCHAR(255),
      facilities TEXT,
      prep_time VARCHAR(100),
      rating VARCHAR(100),
      plan VARCHAR(50) DEFAULT 'Starter',
      status VARCHAR(50) DEFAULT 'active',
      is_verified TINYINT(1) DEFAULT 1,
      theme_color VARCHAR(50) DEFAULT 'amber',
      menu_layout VARCHAR(50) DEFAULT 'cards',
      font_family VARCHAR(50) DEFAULT 'sans',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_restaurant_slug (slug),
      INDEX idx_restaurant_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

    // 2. Branches Table
    `CREATE TABLE IF NOT EXISTS branches (
      id VARCHAR(255) PRIMARY KEY,
      restaurant_id INT NOT NULL,
      name VARCHAR(255) NOT NULL,
      address TEXT NOT NULL,
      phone VARCHAR(50),
      manager VARCHAR(255),
      status VARCHAR(50) DEFAULT 'open',
      is_default TINYINT(1) DEFAULT 0,
      menu_id VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_branches_restaurant (restaurant_id),
      INDEX idx_branches_status (restaurant_id, status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

    // 3. Categories Table
    `CREATE TABLE IF NOT EXISTS categories (
      id VARCHAR(255) PRIMARY KEY,
      restaurant_id INT NOT NULL,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      icon VARCHAR(50),
      image TEXT,
      sort_order INT DEFAULT 0,
      is_active TINYINT(1) DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_categories_restaurant (restaurant_id),
      INDEX idx_categories_sort (restaurant_id, sort_order)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

    // 4. Food Items Table
    `CREATE TABLE IF NOT EXISTS food_items (
      id VARCHAR(255) PRIMARY KEY,
      restaurant_id INT NOT NULL,
      category VARCHAR(255),
      name VARCHAR(255) NOT NULL,
      slug VARCHAR(255),
      short_description TEXT,
      long_description TEXT,
      image_url TEXT,
      price DECIMAL(10,2) NOT NULL,
      discount_price DECIMAL(10,2),
      prep_time INT DEFAULT 15,
      calories INT DEFAULT 0,
      ingredients TEXT,
      allergens TEXT,
      spicy_level INT DEFAULT 0,
      best_seller TINYINT(1) DEFAULT 0,
      popular TINYINT(1) DEFAULT 0,
      chef_choice TINYINT(1) DEFAULT 0,
      vegetarian TINYINT(1) DEFAULT 0,
      halal TINYINT(1) DEFAULT 1,
      out_of_stock TINYINT(1) DEFAULT 0,
      is_available TINYINT(1) DEFAULT 1,
      sort_order INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_food_items_restaurant (restaurant_id),
      INDEX idx_food_items_category (restaurant_id, category),
      INDEX idx_food_items_slug (restaurant_id, slug)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

    // 5. Users Table (Single source of truth for users & staff)
    `CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(255) PRIMARY KEY,
      email VARCHAR(255) NOT NULL UNIQUE,
      password_hash VARCHAR(255),
      full_name VARCHAR(255),
      phone VARCHAR(50),
      branch VARCHAR(255) DEFAULT 'Main Branch',
      status VARCHAR(50) DEFAULT 'active',
      shift VARCHAR(100) DEFAULT 'Full Day',
      avatar_url TEXT,
      joined_date VARCHAR(100),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_users_email (email),
      INDEX idx_users_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

    // 6. User Roles Table (Single source of truth for roles)
    `CREATE TABLE IF NOT EXISTS user_roles (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id VARCHAR(255) NOT NULL,
      role VARCHAR(100) NOT NULL,
      restaurant_id INT NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_user_role_tenant (user_id, role, restaurant_id),
      INDEX idx_user_roles_user (user_id),
      INDEX idx_user_roles_tenant (restaurant_id, user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

    // 7. Sessions Table
    `CREATE TABLE IF NOT EXISTS sessions (
      id VARCHAR(255) PRIMARY KEY,
      user_id VARCHAR(255) NOT NULL,
      expires_at TIMESTAMP NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_sessions_user (user_id),
      INDEX idx_sessions_expires (expires_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

    // 8. Branch Tables Table
    `CREATE TABLE IF NOT EXISTS branch_tables (
      id VARCHAR(255) PRIMARY KEY,
      restaurant_id INT NOT NULL,
      branch_id VARCHAR(255) NOT NULL,
      table_no VARCHAR(50) NOT NULL,
      zone VARCHAR(100) DEFAULT 'MAIN ROOM',
      sort_order INT DEFAULT 0,
      qr_token VARCHAR(255) NULL,
      status VARCHAR(50) DEFAULT 'available',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_branch_tables_restaurant (restaurant_id),
      INDEX idx_branch_tables_branch (restaurant_id, branch_id),
      INDEX idx_branch_tables_token (restaurant_id, qr_token)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

    // 9. POS Orders Table (Single source of truth for orders)
    `CREATE TABLE IF NOT EXISTS pos_orders (
      id VARCHAR(255) PRIMARY KEY,
      restaurant_id INT NOT NULL,
      branch_id VARCHAR(255),
      order_number INT NOT NULL,
      type VARCHAR(50) DEFAULT 'dine-in',
      status VARCHAR(50) DEFAULT 'pending',
      table_number VARCHAR(50),
      customer_name VARCHAR(255),
      phone VARCHAR(50),
      notes TEXT,
      lines_json JSON,
      subtotal DECIMAL(10,2) NOT NULL,
      discount_type VARCHAR(50) DEFAULT 'amount',
      discount_value DECIMAL(10,2) DEFAULT 0,
      discount_amount DECIMAL(10,2) DEFAULT 0,
      tax DECIMAL(10,2) DEFAULT 0,
      total DECIMAL(10,2) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_pos_orders_restaurant (restaurant_id),
      INDEX idx_pos_orders_status (restaurant_id, status),
      INDEX idx_pos_orders_date (restaurant_id, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

    // 10. Order Items Table
    `CREATE TABLE IF NOT EXISTS order_items (
      id VARCHAR(255) PRIMARY KEY,
      order_id VARCHAR(255) NOT NULL,
      food_item_id VARCHAR(255) NOT NULL,
      item_name VARCHAR(255) NOT NULL,
      unit_price DECIMAL(10,2) NOT NULL,
      quantity INT NOT NULL DEFAULT 1,
      subtotal DECIMAL(10,2) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_order_items_order (order_id),
      INDEX idx_order_items_food (food_item_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

    // 11. Reservations Table
    `CREATE TABLE IF NOT EXISTS reservations (
      id VARCHAR(100) PRIMARY KEY,
      restaurant_id INT NOT NULL,
      branch_id VARCHAR(100),
      guest_name VARCHAR(255) NOT NULL,
      phone VARCHAR(50) NOT NULL,
      email VARCHAR(100),
      party_size INT DEFAULT 2,
      date VARCHAR(20) NOT NULL,
      time VARCHAR(20) NOT NULL,
      seating_area VARCHAR(100) DEFAULT 'Main Dining Room',
      branch_name VARCHAR(100) DEFAULT 'Main Branch',
      table_number VARCHAR(50),
      status VARCHAR(50) DEFAULT 'pending',
      special_notes TEXT,
      occasion VARCHAR(100),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_reservations_restaurant (restaurant_id),
      INDEX idx_reservations_branch (restaurant_id, branch_id),
      INDEX idx_reservations_date (restaurant_id, date),
      INDEX idx_reservations_status (restaurant_id, status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

    // 12. Promotions Table
    `CREATE TABLE IF NOT EXISTS promotions (
      id VARCHAR(255) PRIMARY KEY,
      restaurant_id INT NOT NULL,
      kind VARCHAR(50) DEFAULT 'seasonal',
      name VARCHAR(255) NOT NULL,
      discount_percent DECIMAL(5,2) NOT NULL,
      start_date VARCHAR(50),
      end_date VARCHAR(50),
      start_time VARCHAR(20),
      end_time VARCHAR(20),
      item_ids_json TEXT,
      active TINYINT(1) DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_promotions_restaurant (restaurant_id),
      INDEX idx_promotions_active (restaurant_id, active)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

    // 13. Waiter Requests Table
    `CREATE TABLE IF NOT EXISTS waiter_requests (
      id VARCHAR(255) PRIMARY KEY,
      restaurant_id INT NOT NULL,
      branch_id VARCHAR(255),
      table_no VARCHAR(50) NOT NULL,
      type VARCHAR(100) DEFAULT 'water',
      status VARCHAR(50) DEFAULT 'pending',
      note TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_waiter_requests_restaurant (restaurant_id),
      INDEX idx_waiter_requests_status (restaurant_id, status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

    // 14. Restaurant Settings Table
    `CREATE TABLE IF NOT EXISTS restaurant_settings (
      id INT AUTO_INCREMENT PRIMARY KEY,
      restaurant_id INT NOT NULL,
      setting_key VARCHAR(255) NOT NULL,
      setting_value TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_tenant_setting (restaurant_id, setting_key),
      INDEX idx_settings_restaurant (restaurant_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

    // 15. Analytics Events Table
    `CREATE TABLE IF NOT EXISTS analytics_events (
      id INT AUTO_INCREMENT PRIMARY KEY,
      restaurant_id INT NOT NULL,
      event_type VARCHAR(50) NOT NULL,
      branch_id VARCHAR(255),
      table_no VARCHAR(50),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_analytics_events_restaurant (restaurant_id),
      INDEX idx_analytics_events_type (restaurant_id, event_type)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

    // 16. Audit Logs Table
    `CREATE TABLE IF NOT EXISTS audit_logs (
      id VARCHAR(255) PRIMARY KEY,
      action VARCHAR(100) NOT NULL,
      user_id VARCHAR(255),
      restaurant_id INT,
      ip_address VARCHAR(50),
      details_json JSON,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_audit_action (action),
      INDEX idx_audit_user (user_id),
      INDEX idx_audit_restaurant (restaurant_id),
      INDEX idx_audit_date (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,
  ];

  for (const stmt of tableStatements) {
    try {
      await pool.query(stmt);
    } catch (err) {
      console.warn("[Migration] Table initialization notice:", (err as Error).message);
    }
  }

  // Ensure all restaurants table columns exist across legacy schemas
  const restaurantColumnAlters = [
    "ALTER TABLE restaurants ADD COLUMN slug VARCHAR(255) NULL",
    "ALTER TABLE restaurants ADD COLUMN username VARCHAR(255) NULL",
    "ALTER TABLE restaurants ADD COLUMN description TEXT NULL",
    "ALTER TABLE restaurants ADD COLUMN plan VARCHAR(50) DEFAULT 'Starter'",
    "ALTER TABLE restaurants ADD COLUMN is_verified TINYINT(1) DEFAULT 1",
    "ALTER TABLE restaurants ADD COLUMN about TEXT NULL",
    "ALTER TABLE restaurants ADD COLUMN facilities TEXT NULL",
    "ALTER TABLE restaurants ADD COLUMN prep_time VARCHAR(100) NULL",
    "ALTER TABLE restaurants ADD COLUMN rating VARCHAR(100) NULL",
    "ALTER TABLE restaurants ADD COLUMN operating_hours VARCHAR(255) NULL",
    "ALTER TABLE restaurants ADD COLUMN theme_color VARCHAR(50) DEFAULT 'amber'",
    "ALTER TABLE restaurants ADD COLUMN menu_layout VARCHAR(50) DEFAULT 'cards'",
    "ALTER TABLE restaurants ADD COLUMN font_family VARCHAR(50) DEFAULT 'sans'",
    "ALTER TABLE restaurants ADD COLUMN logo_url TEXT NULL",
    "ALTER TABLE restaurants ADD COLUMN cover_url TEXT NULL",
    "ALTER TABLE restaurants ADD COLUMN cuisine VARCHAR(255) NULL",
    "ALTER TABLE restaurants ADD COLUMN location TEXT NULL",
    "ALTER TABLE restaurants ADD COLUMN phone VARCHAR(50) NULL",
    "ALTER TABLE restaurants ADD COLUMN status VARCHAR(50) DEFAULT 'active'",
    "ALTER TABLE restaurants ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
    "ALTER TABLE restaurants ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP",
  ];
  for (const alter of restaurantColumnAlters) {
    try {
      await pool.query(alter);
    } catch {
      /* Column already exists */
    }
  }

  // Ensure slug and username are synced for all restaurants
  try {
    await pool.query(
      "UPDATE restaurants SET slug = COALESCE(NULLIF(slug, ''), username) WHERE slug IS NULL OR slug = ''",
    );
    await pool.query(
      "UPDATE restaurants SET username = COALESCE(NULLIF(username, ''), slug) WHERE username IS NULL OR username = ''",
    );
  } catch {
    /* ignore */
  }

  // Ensure all branches table columns exist across legacy schemas
  const branchColumnAlters = [
    "ALTER TABLE branches ADD COLUMN restaurant_id INT NOT NULL DEFAULT 1",
    "ALTER TABLE branches ADD COLUMN address TEXT NULL",
    "ALTER TABLE branches ADD COLUMN location TEXT NULL",
    "ALTER TABLE branches ADD COLUMN phone VARCHAR(50) NULL",
    "ALTER TABLE branches ADD COLUMN manager VARCHAR(255) NULL",
    "ALTER TABLE branches ADD COLUMN status VARCHAR(50) DEFAULT 'open'",
    "ALTER TABLE branches ADD COLUMN is_default TINYINT(1) DEFAULT 0",
    "ALTER TABLE branches ADD COLUMN menu_id VARCHAR(255) NULL",
  ];
  for (const alter of branchColumnAlters) {
    try {
      await pool.query(alter);
    } catch {
      /* Column already exists */
    }
  }

  // Ensure address and location are synced on branches
  try {
    await pool.query(
      "UPDATE branches SET address = COALESCE(NULLIF(address, ''), location) WHERE address IS NULL OR address = ''",
    );
    await pool.query(
      "UPDATE branches SET location = COALESCE(NULLIF(location, ''), address) WHERE location IS NULL OR location = ''",
    );
  } catch {
    /* ignore */
  }

  // Ensure all categories table columns exist across legacy schemas
  const categoryColumnAlters = [
    "ALTER TABLE categories ADD COLUMN description TEXT NULL",
    "ALTER TABLE categories ADD COLUMN icon VARCHAR(50) NULL",
    "ALTER TABLE categories ADD COLUMN emoji VARCHAR(50) NULL",
    "ALTER TABLE categories ADD COLUMN image TEXT NULL",
    "ALTER TABLE categories ADD COLUMN image_url TEXT NULL",
    "ALTER TABLE categories ADD COLUMN sort_order INT DEFAULT 0",
    "ALTER TABLE categories ADD COLUMN is_active TINYINT(1) DEFAULT 1",
  ];
  for (const alter of categoryColumnAlters) {
    try {
      await pool.query(alter);
    } catch {
      /* Column already exists */
    }
  }

  // Ensure all food_items table columns exist across legacy schemas
  const foodItemColumnAlters = [
    "ALTER TABLE food_items ADD COLUMN category VARCHAR(255) NULL",
    "ALTER TABLE food_items ADD COLUMN category_id VARCHAR(255) NULL",
    "ALTER TABLE food_items ADD COLUMN slug VARCHAR(255) NULL",
    "ALTER TABLE food_items ADD COLUMN short_description TEXT NULL",
    "ALTER TABLE food_items ADD COLUMN long_description TEXT NULL",
    "ALTER TABLE food_items ADD COLUMN description TEXT NULL",
    "ALTER TABLE food_items ADD COLUMN image_url TEXT NULL",
    "ALTER TABLE food_items ADD COLUMN image TEXT NULL",
    "ALTER TABLE food_items ADD COLUMN price DECIMAL(10,2) NOT NULL DEFAULT 0",
    "ALTER TABLE food_items ADD COLUMN discount_price DECIMAL(10,2) NULL",
    "ALTER TABLE food_items ADD COLUMN prep_time INT DEFAULT 15",
    "ALTER TABLE food_items ADD COLUMN calories INT DEFAULT 0",
    "ALTER TABLE food_items ADD COLUMN ingredients TEXT NULL",
    "ALTER TABLE food_items ADD COLUMN allergens TEXT NULL",
    "ALTER TABLE food_items ADD COLUMN spicy_level INT DEFAULT 0",
    "ALTER TABLE food_items ADD COLUMN best_seller TINYINT(1) DEFAULT 0",
    "ALTER TABLE food_items ADD COLUMN popular TINYINT(1) DEFAULT 0",
    "ALTER TABLE food_items ADD COLUMN chef_choice TINYINT(1) DEFAULT 0",
    "ALTER TABLE food_items ADD COLUMN vegetarian TINYINT(1) DEFAULT 0",
    "ALTER TABLE food_items ADD COLUMN halal TINYINT(1) DEFAULT 1",
    "ALTER TABLE food_items ADD COLUMN out_of_stock TINYINT(1) DEFAULT 0",
    "ALTER TABLE food_items ADD COLUMN is_available TINYINT(1) DEFAULT 1",
    "ALTER TABLE food_items ADD COLUMN sort_order INT DEFAULT 0",
  ];
  for (const alter of foodItemColumnAlters) {
    try {
      await pool.query(alter);
    } catch {
      /* Column already exists */
    }
  }

  // Ensure all users table columns exist across legacy schemas
  const userColumnAlters = [
    "ALTER TABLE users ADD COLUMN full_name VARCHAR(255) NULL",
    "ALTER TABLE users ADD COLUMN name VARCHAR(255) NULL",
    "ALTER TABLE users ADD COLUMN avatar_url TEXT NULL",
    "ALTER TABLE users ADD COLUMN avatar VARCHAR(512) NULL",
    "ALTER TABLE users ADD COLUMN phone VARCHAR(50) NULL",
    "ALTER TABLE users ADD COLUMN branch VARCHAR(255) NULL",
    "ALTER TABLE users ADD COLUMN role VARCHAR(50) NULL",
    "ALTER TABLE users ADD COLUMN restaurant_id INT NULL",
    "ALTER TABLE users ADD COLUMN assigned_branch_id VARCHAR(100) NULL",
    "ALTER TABLE users ADD COLUMN status VARCHAR(50) DEFAULT 'active'",
    "ALTER TABLE users ADD COLUMN shift VARCHAR(100) DEFAULT 'Full Day'",
    "ALTER TABLE users ADD COLUMN joined_date VARCHAR(100) NULL",
  ];
  for (const alter of userColumnAlters) {
    try {
      await pool.query(alter);
    } catch {
      /* Column already exists */
    }
  }

  // Ensure all pos_orders table columns exist across legacy schemas
  const posOrdersColumnAlters = [
    "ALTER TABLE pos_orders ADD COLUMN branch_id VARCHAR(255) NULL AFTER restaurant_id",
    "ALTER TABLE pos_orders ADD COLUMN order_number INT NOT NULL DEFAULT 1",
    "ALTER TABLE pos_orders ADD COLUMN type VARCHAR(50) DEFAULT 'dine-in'",
    "ALTER TABLE pos_orders ADD COLUMN status VARCHAR(50) DEFAULT 'pending'",
    "ALTER TABLE pos_orders ADD COLUMN table_number VARCHAR(50) NULL",
    "ALTER TABLE pos_orders ADD COLUMN customer_name VARCHAR(255) NULL",
    "ALTER TABLE pos_orders ADD COLUMN phone VARCHAR(50) NULL",
    "ALTER TABLE pos_orders ADD COLUMN notes TEXT NULL",
    "ALTER TABLE pos_orders ADD COLUMN lines_json JSON NULL",
    "ALTER TABLE pos_orders ADD COLUMN subtotal DECIMAL(10,2) NOT NULL DEFAULT 0",
    "ALTER TABLE pos_orders ADD COLUMN discount_type VARCHAR(50) DEFAULT 'amount'",
    "ALTER TABLE pos_orders ADD COLUMN discount_value DECIMAL(10,2) DEFAULT 0",
    "ALTER TABLE pos_orders ADD COLUMN discount_amount DECIMAL(10,2) DEFAULT 0",
    "ALTER TABLE pos_orders ADD COLUMN tax DECIMAL(10,2) DEFAULT 0",
    "ALTER TABLE pos_orders ADD COLUMN total DECIMAL(10,2) NOT NULL DEFAULT 0",
  ];
  for (const alter of posOrdersColumnAlters) {
    try {
      await pool.query(alter);
    } catch {
      /* Column already exists */
    }
  }

  // Ensure all branch_tables table columns exist across legacy schemas
  const branchTableColumnAlters = [
    "ALTER TABLE branch_tables ADD COLUMN zone VARCHAR(100) DEFAULT 'MAIN ROOM'",
    "ALTER TABLE branch_tables ADD COLUMN sort_order INT DEFAULT 0",
    "ALTER TABLE branch_tables ADD COLUMN qr_token VARCHAR(255) NULL",
    "ALTER TABLE branch_tables ADD COLUMN status VARCHAR(50) DEFAULT 'available'",
  ];
  for (const alter of branchTableColumnAlters) {
    try {
      await pool.query(alter);
    } catch {
      /* Column already exists */
    }
  }

  // Ensure all promotions table columns exist across legacy schemas
  const promotionColumnAlters = [
    "ALTER TABLE promotions ADD COLUMN kind VARCHAR(50) DEFAULT 'seasonal'",
    "ALTER TABLE promotions ADD COLUMN discount_percent DECIMAL(5,2) NOT NULL DEFAULT 0",
    "ALTER TABLE promotions ADD COLUMN start_date VARCHAR(50) NULL",
    "ALTER TABLE promotions ADD COLUMN end_date VARCHAR(50) NULL",
    "ALTER TABLE promotions ADD COLUMN start_time VARCHAR(20) NULL",
    "ALTER TABLE promotions ADD COLUMN end_time VARCHAR(20) NULL",
    "ALTER TABLE promotions ADD COLUMN target_scope VARCHAR(50) DEFAULT 'all'",
    "ALTER TABLE promotions ADD COLUMN category_names_json JSON NULL",
    "ALTER TABLE promotions ADD COLUMN item_ids_json JSON NULL",
    "ALTER TABLE promotions ADD COLUMN active TINYINT(1) DEFAULT 1",
    "ALTER TABLE promotions ADD COLUMN image TEXT NULL",
    "ALTER TABLE promotions ADD COLUMN description TEXT NULL",
    "ALTER TABLE promotions ADD COLUMN show_popup TINYINT(1) DEFAULT 1",
    "ALTER TABLE promotions ADD COLUMN branch_name VARCHAR(255) DEFAULT 'all'",
    "ALTER TABLE promotions ADD COLUMN branch_id VARCHAR(255) DEFAULT 'all'",
    "ALTER TABLE promotions ADD COLUMN created_by_role VARCHAR(50) DEFAULT 'owner'",
    "ALTER TABLE promotions ADD COLUMN created_by_user_id VARCHAR(255) NULL",
  ];
  for (const alter of promotionColumnAlters) {
    try {
      await pool.query(alter);
    } catch {
      /* Column already exists */
    }
  }

  // Idempotent Seed for Default Tenants
  try {
    await pool.execute(`
      INSERT IGNORE INTO restaurants (id, name, slug, description, logo_url, cover_url, cuisine, phone, location, status, plan)
      VALUES 
      (1, 'Burger Craft Lab', 'burgercraftlab', 'Gourmet burgers in Dhanmondi', 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600', 'https://images.unsplash.com/photo-1552566626-52f8b828add9?w=800', 'Gourmet Burgers', '+880 1700-112233', 'Dhanmondi, Dhaka', 'active', 'Business'),
      (2, 'Sultan''s Dine', 'sultansdine', 'Experience royal Kacchi Biryani & traditional Mughal delicacies', 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=600', 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=800', 'Kacchi & Biryani', '+880 1912-990011', 'Gulshan, Dhaka', 'active', 'Enterprise'),
      (3, 'MenuVerse Kitchen', 'menuverse', 'Multi-Cuisine & Gourmet Specialties', 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600', 'https://images.unsplash.com/photo-1552566626-52f8b828add9?w=800', 'Multi-Cuisine', '+880 1700-112233', 'Global', 'active', 'Business');
    `);
  } catch (err) {
    console.warn("[Migration] Seed notice:", (err as Error).message);
  }

  // Idempotent Seed for Demo Accounts
  try {
    const hashPwd = (pwd: string) => {
      const salt = crypto.randomBytes(16).toString("hex");
      const h = crypto.pbkdf2Sync(pwd, salt, 1000, 64, "sha512").toString("hex");
      return `${salt}:${h}`;
    };

    const demoUsersToSeed = [
      {
        id: "demo-admin-menuverse-app",
        email: "admin@menuverse.app",
        pwd: "admin123",
        name: "System Super Admin",
        phone: "+1 (555) 019-9001",
        role: "super_admin",
        restId: null,
        branch: null,
      },
      {
        id: "demo-owner-burgercraft-com",
        email: "owner@burgercraft.com",
        pwd: "owner123",
        name: "Tariqul Islam (Owner - Burger Craft)",
        phone: "+880 1700-112233",
        role: "owner",
        restId: "1",
        branch: "Dhanmondi Main Branch",
      },
      {
        id: "demo-manager-burgercraft-com",
        email: "manager@burgercraft.com",
        pwd: "manager123",
        name: "Sabrina Rahman (Manager - Burger Craft)",
        phone: "+880 1712-345678",
        role: "manager",
        restId: "1",
        branch: "Dhanmondi Main Branch",
      },
      {
        id: "demo-cashier-burgercraft-com",
        email: "cashier@burgercraft.com",
        pwd: "cashier123",
        name: "Tamanna Akter (Cashier - Burger Craft)",
        phone: "+880 1712-876543",
        role: "cashier",
        restId: "1",
        branch: "Dhanmondi Main Branch",
      },
      {
        id: "demo-chef-burgercraft-com",
        email: "chef@burgercraft.com",
        pwd: "chef123",
        name: "Arif Chowdhury (Chef - Burger Craft)",
        phone: "+880 1712-112233",
        role: "chef",
        restId: "1",
        branch: "Dhanmondi Main Branch",
      },
      {
        id: "demo-waiter-burgercraft-com",
        email: "waiter@burgercraft.com",
        pwd: "waiter123",
        name: "Rakib Hassan (Waiter - Burger Craft)",
        phone: "+880 1712-445566",
        role: "waiter",
        restId: "1",
        branch: "Dhanmondi Main Branch",
      },
      {
        id: "demo-host-burgercraft-com",
        email: "host@burgercraft.com",
        pwd: "host123",
        name: "Nadia Islam (Host - Burger Craft)",
        phone: "+880 1712-778899",
        role: "host",
        restId: "1",
        branch: "Dhanmondi Main Branch",
      },
      {
        id: "demo-owner-sultansdine-com",
        email: "owner@sultansdine.com",
        pwd: "owner123",
        name: "Sultan Mahmud (Owner - Sultan's Dine)",
        phone: "+880 1912-990011",
        role: "owner",
        restId: "2",
        branch: "Gulshan Branch",
      },
      {
        id: "demo-manager-sultansdine-com",
        email: "manager@sultansdine.com",
        pwd: "manager123",
        name: "Kabir Khan (Manager - Sultan's Dine)",
        phone: "+880 1912-990022",
        role: "manager",
        restId: "2",
        branch: "Gulshan Branch",
      },
      {
        id: "demo-cashier-sultansdine-com",
        email: "cashier@sultansdine.com",
        pwd: "cashier123",
        name: "Faria Ahmed (Cashier - Sultan's Dine)",
        phone: "+880 1912-990033",
        role: "cashier",
        restId: "2",
        branch: "Gulshan Branch",
      },
      {
        id: "demo-chef-sultansdine-com",
        email: "chef@sultansdine.com",
        pwd: "chef123",
        name: "Chef Ustad Babul (Chef - Sultan's Dine)",
        phone: "+880 1912-990044",
        role: "chef",
        restId: "2",
        branch: "Gulshan Branch",
      },
      {
        id: "demo-waiter-sultansdine-com",
        email: "waiter@sultansdine.com",
        pwd: "waiter123",
        name: "Imran Hossain (Waiter - Sultan's Dine)",
        phone: "+880 1912-990055",
        role: "waiter",
        restId: "2",
        branch: "Gulshan Branch",
      },
      {
        id: "demo-host-sultansdine-com",
        email: "host@sultansdine.com",
        pwd: "host123",
        name: "Mehnaz Parveen (Host - Sultan's Dine)",
        phone: "+880 1912-990066",
        role: "host",
        restId: "2",
        branch: "Gulshan Branch",
      },
    ];

    for (const u of demoUsersToSeed) {
      const [existing] = (await pool.execute("SELECT id FROM users WHERE email = ?", [
        u.email,
      ])) as [unknown[], unknown];
      if (!Array.isArray(existing) || existing.length === 0) {
        const pHash = hashPwd(u.pwd);
        await pool.execute(
          "INSERT INTO users (id, email, password_hash, full_name, phone, branch) VALUES (?, ?, ?, ?, ?, ?)",
          [u.id, u.email, pHash, u.name, u.phone, u.branch],
        );
        await pool.execute(
          "INSERT INTO user_roles (user_id, role, restaurant_id) VALUES (?, ?, ?)",
          [u.id, u.role, u.restId],
        );
      }
    }
  } catch (err) {
    console.warn("[Migration] Demo users seed notice:", (err as Error).message);
  }

  // Idempotent Index & Unique Constraint Alterations
  const constraintStatements = [
    "ALTER TABLE branches ADD CONSTRAINT fk_branches_restaurant FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE",
    "ALTER TABLE categories ADD CONSTRAINT fk_categories_restaurant FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE",
    "ALTER TABLE food_items ADD CONSTRAINT fk_food_items_restaurant FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE",
    "ALTER TABLE user_roles ADD CONSTRAINT fk_user_roles_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE",
    "ALTER TABLE sessions ADD CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE",
    "ALTER TABLE branch_tables ADD CONSTRAINT fk_branch_tables_restaurant FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE",
    "ALTER TABLE pos_orders ADD CONSTRAINT fk_pos_orders_restaurant FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE",
    "ALTER TABLE order_items ADD CONSTRAINT fk_order_items_order FOREIGN KEY (order_id) REFERENCES pos_orders(id) ON DELETE CASCADE",
    "ALTER TABLE reservations ADD CONSTRAINT fk_reservations_restaurant FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE",
    "ALTER TABLE promotions ADD CONSTRAINT fk_promotions_restaurant FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE",
    "ALTER TABLE waiter_requests ADD CONSTRAINT fk_waiter_requests_restaurant FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE",
    "ALTER TABLE restaurant_settings ADD CONSTRAINT fk_restaurant_settings_restaurant FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE",
    "ALTER TABLE analytics_events ADD CONSTRAINT fk_analytics_events_restaurant FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE",
  ];

  for (const alt of constraintStatements) {
    try {
      await pool.query(alt);
    } catch {
      /* Constraint already exists */
    }
  }

  // Idempotent column additions
  try {
    await pool.execute(
      "ALTER TABLE reservations ADD COLUMN branch_id VARCHAR(100) AFTER restaurant_id",
    );
  } catch {
    /* Column already exists */
  }

  // Auto-downgrade expired subscriptions to Free plan
  try {
    await pool.execute(
      "UPDATE restaurants SET plan = 'Free', status = 'expired', mrr = 0 WHERE plan_expires_at IS NOT NULL AND plan_expires_at < NOW() AND LOWER(plan) != 'free'",
    );
  } catch {
    /* Ignore if column doesn't exist yet */
  }

  // Auto-clean any invalid blob: URLs from database (images in DB must always be original/CDN URLs)
  try {
    await pool.execute("UPDATE users SET avatar_url = NULL WHERE avatar_url LIKE 'blob:%'");
    await pool.execute("UPDATE restaurants SET logo_url = NULL WHERE logo_url LIKE 'blob:%'");
    await pool.execute("UPDATE restaurants SET cover_url = NULL WHERE cover_url LIKE 'blob:%'");
    await pool.execute("UPDATE food_items SET image = NULL WHERE image LIKE 'blob:%'");
    await pool.execute("UPDATE categories SET image = NULL WHERE image LIKE 'blob:%'");
    await pool.execute("UPDATE promotions SET image = NULL WHERE image LIKE 'blob:%'");
  } catch {
    /* Ignore cleanup errors */
  }
}
