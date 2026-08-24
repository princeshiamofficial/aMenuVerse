import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { Client } = require("ssh2");
const fs = require("fs");
const path = require("path");

const conn = new Client();
conn
  .on("ready", () => {
    console.log("SSH connection ready");
    conn.sftp((err, sftp) => {
      if (err) {
        console.error("SFTP error:", err);
        conn.end();
        process.exit(1);
      }
      console.log("SFTP session started");

      const localFile = path.join(__dirname, "../deploy-prod.zip");
      const remoteFile = "/home/menuversebd.com/public_html/deploy-prod.zip";

      console.log(`Uploading ${localFile} to ${remoteFile}...`);
      sftp.fastPut(
        localFile,
        remoteFile,
        {
          chunkSize: 32768,
          concurrency: 64,
          step: (transferred, chunk, total) => {
            const pct = Math.round((transferred / total) * 100);
            console.log(`Uploaded ${pct}% (${transferred}/${total} bytes)`);
          },
        },
        (uploadErr) => {
          if (uploadErr) {
            console.error("Upload failed:", uploadErr);
            conn.end();
            process.exit(1);
          }
          console.log("Upload complete. Executing commands on remote server...");

          const commands = [
            "cd /home/menuversebd.com/public_html",
            "unzip -o deploy-prod.zip",
            "rm deploy-prod.zip",
            "npm install --production",
            'pm2 restart menuverse || pm2 start "npm start -- -p 3008" --name "menuverse"',
            "pm2 save",
          ].join(" && ");

          conn.exec(commands, (execErr, stream) => {
            if (execErr) {
              console.error("Execution failed:", execErr);
              conn.end();
              process.exit(1);
            }

            stream
              .on("close", (code, signal) => {
                console.log(`Remote execution finished with code ${code}`);
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
        },
      );
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
