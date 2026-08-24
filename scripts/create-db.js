import mysql from "mysql2/promise";

async function setupDatabase() {
  const host = process.env.MYSQL_HOST || "localhost";
  const port = process.env.MYSQL_PORT ? parseInt(process.env.MYSQL_PORT) : 3306;
  const user = process.env.MYSQL_USER || "root";
  const password = process.env.MYSQL_PASSWORD || "";

  console.log(`Connecting to MySQL server at ${host}:${port}...`);
  try {
    const connection = await mysql.createConnection({
      host,
      port,
      user,
      password,
    });

    console.log("Connected to MySQL server!");

    // Create database amenuverse if it doesn't exist
    await connection.query("CREATE DATABASE IF NOT EXISTS amenuverse");
    console.log("Database 'amenuverse' created / verified successfully!");

    await connection.query("USE amenuverse");

    // Create tables
    await connection.query(`
      CREATE TABLE IF NOT EXISTS restaurants (
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
        status VARCHAR(50) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    const restaurantAlterStatements = [
      "ALTER TABLE restaurants ADD COLUMN status VARCHAR(50) DEFAULT 'active'",
      "ALTER TABLE restaurants ADD COLUMN theme_color VARCHAR(50) DEFAULT 'amber'",
      "ALTER TABLE restaurants ADD COLUMN menu_layout VARCHAR(50) DEFAULT 'cards'",
      "ALTER TABLE restaurants ADD COLUMN font_family VARCHAR(50) DEFAULT 'sans'",
    ];
    for (const statement of restaurantAlterStatements) {
      try {
        await connection.query(statement);
      } catch {
        // Column may already exist
      }
    }
    console.log("Table 'restaurants' verified!");

    await connection.query(`
      CREATE TABLE IF NOT EXISTS menu_categories (
        id INT AUTO_INCREMENT PRIMARY KEY,
        restaurant_id INT DEFAULT 1,
        name VARCHAR(255) NOT NULL,
        slug VARCHAR(255) NOT NULL,
        description TEXT,
        display_order INT DEFAULT 0,
        is_active TINYINT(1) DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log("Table 'menu_categories' verified!");

    await connection.query(`
      CREATE TABLE IF NOT EXISTS menu_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        category_id INT,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        price DECIMAL(10,2) NOT NULL,
        image_url TEXT,
        is_available TINYINT(1) DEFAULT 1,
        is_featured TINYINT(1) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log("Table 'menu_items' verified!");

    await connection.query(`
      CREATE TABLE IF NOT EXISTS reservations (
        id VARCHAR(100) PRIMARY KEY,
        restaurant_id INT DEFAULT 1,
        guest_name VARCHAR(255) NOT NULL,
        phone VARCHAR(50) NOT NULL,
        email VARCHAR(100),
        party_size INT DEFAULT 2,
        date VARCHAR(20) NOT NULL,
        time VARCHAR(20) NOT NULL,
        seating_area VARCHAR(100) DEFAULT 'Main Dining Room',
        table_number VARCHAR(50),
        status VARCHAR(50) DEFAULT 'pending',
        special_notes TEXT,
        occasion VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log("Table 'reservations' verified!");

    // Seed default restaurants if empty
    const [rows] = await connection.query("SELECT COUNT(*) as count FROM restaurants");
    if (rows[0].count === 0) {
      await connection.query(`
        INSERT INTO restaurants (name, slug, description, logo_url, cover_url, cuisine, phone, location, operating_hours, facilities, prep_time, rating, theme_color, menu_layout, font_family)
        VALUES 
        (
          'Burger Craft Lab',
          'burgercraftlab',
          'Welcome to Burger Craft Lab digital menu. Scan our unique QR codes directly at your table to place real-time kitchen orders instantly.',
          'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=80&auto=format&fit=crop&q=80',
          'https://images.unsplash.com/photo-1552566626-52f8b828add9?w=800&auto=format&fit=crop&q=80',
          'Gourmet Burgers',
          '+880 1700-112233',
          'Dhanmondi, Dhaka',
          '11:00 AM - 11:30 PM',
          'Air Conditioned, Wifi, Table QR ordering, bKash payments accepted',
          '15-25 min',
          '4.9 Stars (340 reviews)',
          'amber',
          'cards',
          'sans'
        ),
        (
          'Sultan\'s Dine',
          'sultansdine',
          'Experience royal Kacchi Biryani & traditional Mughal delicacies at Sultan\'s Dine.',
          'https://images.unsplash.com/photo-1631515243349-e0cb75fb8d3a?w=80&auto=format&fit=crop&q=80',
          'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=800&auto=format&fit=crop&q=80',
          'Traditional Mughal & Kacchi Biryani',
          '+880 1912-990011',
          'Satmasjid Road, Dhanmondi, Dhaka',
          '12:00 PM - 11:00 PM',
          'Air Conditioned, Private Dining, Family Party Space, bKash & Card Payments',
          '10-20 min',
          '4.9 Stars (1.5k reviews)',
          'rose',
          'cards',
          'serif'
        )
      `);
      console.log(
        "Seeded initial restaurant data (Burger Craft Lab & Sultan's Dine) into 'restaurants' table!",
      );
    }

    console.log("\n🎉 Database setup complete! 'amenuverse' is now visible in phpMyAdmin!");
    await connection.end();
  } catch (err) {
    console.error("MySQL Connection Error:", err.message);
  }
}

setupDatabase();
