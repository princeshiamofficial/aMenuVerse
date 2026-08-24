import { Client } from "ssh2";

const conn = new Client();
conn
  .on("ready", () => {
    console.log("SSH connection ready. Starting deployment...");

    // Script to run on the server
    const commands = [
      "cd /home/menuversebd.com/public_html",
      "echo '=== PM2 STATUS ==='",
      "pm2 status",
      "echo '=== NETSTAT/SS NODE PORTS ==='",
      "netstat -tulpn | grep node || ss -tulpn | grep node || true",
      "echo '=== CURL 127.0.0.1:3008 ==='",
      "curl -I http://127.0.0.1:3008 || true",
      "echo '=== CURL LOCALHOST:3008 ==='",
      "curl -I http://localhost:3008 || true",
      "echo '=== PM2 RECENT LOGS ==='",
      "pm2 logs menuverse --lines 30 --raw || true",
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
