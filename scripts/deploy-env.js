import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { Client } = require("ssh2");

const conn = new Client();
conn
  .on("ready", () => {
    console.log("SSH connection ready. Writing environment file...");

    const envContent = `MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=menu_verse
MYSQL_PASSWORD=C0l0rHu7@456
MYSQL_DATABASE=menu_verse
REDIS_URL=redis://127.0.0.1:6379
JWT_SECRET=super_secret_key_123456789_super_secret_key
`;

    // Escape the content so we can write it using echo in bash
    const escapedEnvContent = envContent.replace(/"/g, '\\"').replace(/\n/g, "\\n");

    const commands = [
      "cd /home/menuversebd.com/public_html",
      // Write .env
      `printf "${escapedEnvContent}" > .env`,
      // Modify scripts/schema.sql on server to comment out hardcoded database statements
      "sed -i 's/^CREATE DATABASE IF NOT EXISTS digital_food_menu;/-- CREATE DATABASE IF NOT EXISTS digital_food_menu;/g' scripts/schema.sql",
      "sed -i 's/^USE digital_food_menu;/-- USE digital_food_menu;/g' scripts/schema.sql",
      // Run database seeding script
      "node scripts/seed.js",
      // Restart PM2 app with --update-env to pick up the new env variables
      "pm2 restart menuverse --update-env",
      "pm2 save",
    ].join(" && ");

    console.log("Running remote configuration and database seeding...");
    conn.exec(commands, (err, stream) => {
      if (err) {
        console.error("Execution error:", err);
        conn.end();
        process.exit(1);
      }

      stream
        .on("close", (code, signal) => {
          console.log(`\nDeployment configuration and seeding finished with exit code ${code}`);
          conn.end();
          process.exit(code === 0 ? 0 : 1);
        })
        .on("data", (data) => {
          process.stdout.write(data.toString());
        })
        .stderr.on("data", (data) => {
          process.stderr.write(data.toString());
        });
    });
  })
  .on("error", (err) => {
    console.error("Connection error:", err);
    process.exit(1);
  })
  .connect({
    host: "93.127.166.176",
    port: 22,
    username: "menuv3746",
    password: "menuv3746",
  });
