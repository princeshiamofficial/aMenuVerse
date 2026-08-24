import mysql from "mysql2/promise";

async function deleteMenuverseAppUsers() {
  const host = process.env.MYSQL_HOST || "localhost";
  const port = process.env.MYSQL_PORT ? parseInt(process.env.MYSQL_PORT) : 3306;
  const user = process.env.MYSQL_USER || "root";
  const password = process.env.MYSQL_PASSWORD || "";
  const database = process.env.MYSQL_DATABASE || "amenuverse";

  console.log(`Connecting to MySQL ${database} at ${host}:${port}...`);
  try {
    const connection = await mysql.createConnection({
      host,
      port,
      user,
      password,
      database,
    });

    console.log("Connected to amenuverse database!");

    // Delete user_roles for @menuverse.app users EXCEPT admin@menuverse.app
    const [rolesResult] = await connection.query(`
      DELETE FROM user_roles 
      WHERE user_id IN (
        SELECT id FROM users WHERE email LIKE '%@menuverse.app' AND LOWER(email) != 'admin@menuverse.app'
      )
    `);
    console.log(`Deleted ${rolesResult.affectedRows || 0} user_roles entries.`);

    // Delete users with @menuverse.app email EXCEPT admin@menuverse.app
    const [usersResult] = await connection.query(`
      DELETE FROM users 
      WHERE email LIKE '%@menuverse.app' AND LOWER(email) != 'admin@menuverse.app'
    `);
    console.log(
      `Deleted ${usersResult.affectedRows || 0} users with @menuverse.app email (preserved admin@menuverse.app).`,
    );

    // Also delete staff with @menuverse.app email EXCEPT admin@menuverse.app
    try {
      const [staffResult] = await connection.query(`
        DELETE FROM staff 
        WHERE email LIKE '%@menuverse.app' AND LOWER(email) != 'admin@menuverse.app'
      `);
      console.log(
        `Deleted ${staffResult.affectedRows || 0} staff entries with @menuverse.app email.`,
      );
    } catch {
      /* ignore if staff table doesn't exist */
    }

    await connection.end();
    console.log("Cleanup script completed successfully!");
  } catch (err) {
    console.error("Error executing cleanup script:", err.message);
  }
}

deleteMenuverseAppUsers();
