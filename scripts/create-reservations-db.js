import mysql from "mysql2/promise";

async function createReservationsTable() {
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

    // Create reservations table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS reservations (
        id VARCHAR(100) PRIMARY KEY,
        restaurant_id INT DEFAULT 1,
        branch_name VARCHAR(255),
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

    // Alter table if restaurant_id or branch_name columns don't exist yet
    try {
      await connection.query("ALTER TABLE reservations ADD COLUMN restaurant_id INT DEFAULT 1");
    } catch {
      /* Column already exists */
    }
    try {
      await connection.query("ALTER TABLE reservations ADD COLUMN branch_name VARCHAR(255)");
    } catch {
      /* Column already exists */
    }

    // Truncate fallback mock data
    await connection.query("TRUNCATE TABLE reservations");

    const sampleReservations = [
      // Restaurant 1: Burger Craft Lab
      {
        id: "res-bc-1",
        restaurant_id: 1,
        guest_name: "Mehan Ahmed",
        phone: "+880 1711-001122",
        email: "mehan@gmail.com",
        party_size: 4,
        date: "2026-08-05",
        time: "07:30 PM",
        seating_area: "Main Dining Room",
        table_number: "T-04",
        status: "confirmed",
        special_notes: "Window side table requested for birthday celebration.",
        occasion: "Birthday",
        branch_name: "Dhanmondi Flagship Branch",
      },
      {
        id: "res-bc-2",
        restaurant_id: 1,
        guest_name: "Nusrat Jahan",
        phone: "+880 1812-334455",
        email: "nusrat@yahoo.com",
        party_size: 2,
        date: "2026-08-05",
        time: "08:15 PM",
        seating_area: "Outdoor Patio",
        table_number: "P-02",
        status: "seated",
        special_notes: "Anniversary dinner",
        occasion: "Anniversary",
        branch_name: "Gulshan Bistro Branch",
      },
      {
        id: "res-bc-3",
        restaurant_id: 1,
        guest_name: "Farhan Ahmed",
        phone: "+880 1913-667788",
        email: "farhan@outlook.com",
        party_size: 6,
        date: "2026-08-06",
        time: "01:00 PM",
        seating_area: "VIP Lounge",
        table_number: "V-01",
        status: "pending",
        special_notes: "Business lunch reservation.",
        occasion: "Business Lunch",
        branch_name: "Uttara Express Kitchen",
      },

      // Restaurant 2: Sultan's Dine
      {
        id: "res-sd-1",
        restaurant_id: 2,
        guest_name: "Haji Mohammad Ali",
        phone: "+880 1912-990011",
        email: "haji.ali@gmail.com",
        party_size: 10,
        date: "2026-08-05",
        time: "08:00 PM",
        seating_area: "Royal Mughal Family Lounge",
        table_number: "R-01",
        status: "confirmed",
        special_notes: "Traditional Kacchi Biryani feast for family gathering.",
        occasion: "Family Gathering",
        branch_name: "Dhanmondi Branch",
      },
      {
        id: "res-sd-2",
        restaurant_id: 2,
        guest_name: "Saifur Rahman",
        phone: "+880 1715-443322",
        email: "saifur@gmail.com",
        party_size: 5,
        date: "2026-08-05",
        time: "01:30 PM",
        seating_area: "Main Dining Hall",
        table_number: "M-08",
        status: "seated",
        special_notes: "Extra Borhani pitchers requested.",
        occasion: "Get Together",
        branch_name: "Gulshan Branch",
      },
      {
        id: "res-sd-3",
        restaurant_id: 2,
        guest_name: "Sharmin Sultana",
        phone: "+880 1819-887766",
        email: "sharmin@gmail.com",
        party_size: 12,
        date: "2026-08-07",
        time: "07:00 PM",
        seating_area: "Banquet Hall",
        table_number: "B-03",
        status: "pending",
        special_notes: "Shahi Firni dessert arrangement.",
        occasion: "Corporate Dinner",
        branch_name: "Uttara Branch",
      },
    ];

    for (const r of sampleReservations) {
      await connection.query(
        `INSERT INTO reservations (
          id, restaurant_id, guest_name, phone, email, party_size, date, time, seating_area, table_number, status, special_notes, occasion, branch_name
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          r.id,
          r.restaurant_id,
          r.guest_name,
          r.phone,
          r.email,
          r.party_size,
          r.date,
          r.time,
          r.seating_area,
          r.table_number,
          r.status,
          r.special_notes,
          r.occasion,
          r.branch_name,
        ],
      );
    }

    console.log("Table 'reservations' populated with distinct tenant reservations!");
    await connection.end();
  } catch (err) {
    console.error("MySQL Error:", err.message);
  }
}

createReservationsTable();
