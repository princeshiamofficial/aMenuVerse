const { Client } = require("ssh2");

const conn = new Client();
conn
  .on("ready", () => {
    console.log("SSH connection ready. Starting deployment...");

    // Script to run on the server
    const commands = [
      "cd /home/menuversebd.com/public_html",
      // Check if .git exists, if not clone the repo
      'if [ ! -d ".git" ]; then echo "Cloning repository..."; git clone https://github.com/princeshiamofficial/aMenuVerse.git .; else echo "Repository already exists. Pulling latest..."; git checkout package.json package-lock.json; git pull origin main; fi',
      // Install dependencies
      "npm install",
      // Build Next.js app
      "npm run build",
      // Start or restart PM2 app
      'pm2 restart menuverse || pm2 start "npm start -- -p 3008" --name "menuverse"',
      "pm2 save",
    ].join(" && ");

    console.log("Running deployment commands on remote server...");
    conn.exec(commands, (err, stream) => {
      if (err) {
        console.error("Execution error:", err);
        conn.end();
        process.exit(1);
      }

      stream
        .on("close", (code, signal) => {
          console.log(`\nDeployment finished with exit code ${code}`);
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
