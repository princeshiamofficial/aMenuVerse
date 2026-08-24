import mysql from "mysql2/promise";

async function fixRestaurants() {
  const conn = await mysql.createConnection({
    host: process.env.MYSQL_HOST || "localhost",
    user: process.env.MYSQL_USER || "root",
    password: process.env.MYSQL_PASSWORD || "",
    database: process.env.MYSQL_DATABASE || "amenuverse",
  });

  // Fix Burger Craft Lab slug and plan
  await conn.execute(
    "UPDATE restaurants SET slug = 'burgercraftlab', plan = 'Business' WHERE id = 1",
  );
  console.log("Fixed Burger Craft Lab slug → burgercraftlab, plan → Business");

  // Ensure Sultan's Dine plan is correct
  await conn.execute("UPDATE restaurants SET plan = 'Enterprise' WHERE id = 2");
  console.log("Fixed Sultan's Dine plan → Enterprise");

  const [rows] = await conn.execute("SELECT id, name, slug, status, plan FROM restaurants");
  console.log("✅ Final restaurants table:", rows);

  await conn.end();
}

fixRestaurants().catch(console.error);
