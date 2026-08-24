import { Client } from "ssh2";

const conn = new Client();
conn
  .on("ready", () => {
    console.log("SSH connection ready. Starting deployment...");

    // Script to run on the server
    const commands = [
      "cd /home/menuversebd.com/public_html",
      'if [ ! -d ".git" ]; then echo "Initializing git repo..."; git init && (git remote add origin https://github.com/princeshiamofficial/aMenuVerse.git || git remote set-url origin https://github.com/princeshiamofficial/aMenuVerse.git) && git fetch origin main && git reset --hard origin/main && (git branch --set-upstream-to=origin/main main || git checkout -b main origin/main); else echo "Repository exists. Fetching latest..."; git remote set-url origin https://github.com/princeshiamofficial/aMenuVerse.git && git fetch origin main && git reset --hard origin/main; fi',
      "npm install",
      "npm run build",
      'PORT=3008 pm2 restart menuverse || PORT=3008 pm2 start .output/server/index.mjs --name "menuverse"',
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
