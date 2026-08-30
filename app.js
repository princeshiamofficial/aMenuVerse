import http from "node:http";
import { parse } from "node:url";
import fs from "node:fs";
import path from "node:path";
import next from "next";

// 1. Automatically load environment files (.env, .env.local, .env.production)
const envFiles = [".env", ".env.local", ".env.production"];
for (const file of envFiles) {
  const envPath = path.resolve(process.cwd(), file);
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, "utf-8");
    for (const line of envContent.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx > 0) {
        const key = trimmed.slice(0, eqIdx).trim();
        const val = trimmed
          .slice(eqIdx + 1)
          .trim()
          .replace(/^["']|["']$/g, "");
        if (key && process.env[key] === undefined) {
          process.env[key] = val;
        }
      }
    }
  }
}

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME || "0.0.0.0";
const port = parseInt(process.env.PORT || "3000", 10);

// 2. Initialize Next.js Application Server
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app
  .prepare()
  .then(() => {
    const server = http.createServer(async (req, res) => {
      try {
        const parsedUrl = parse(req.url || "/", true);
        await handle(req, res, parsedUrl);
      } catch (err) {
        console.error("Error handling request:", err);
        if (!res.headersSent) {
          res.statusCode = 500;
          res.end("Internal Server Error");
        }
      }
    });

    server.listen(port, hostname, () => {
      console.log(`> aMenuVerse Server ready on http://${hostname}:${port} [PID: ${process.pid}] [Mode: ${process.env.NODE_ENV || "production"}]`);
      if (typeof process.send === "function") {
        process.send("ready"); // Notify PM2 cluster load balancer that worker is ready
      }
    });

    // 3. Graceful Shutdown for Zero-Downtime Rolling Restarts
    const shutdown = (signal) => {
      console.log(`> Received ${signal}. Gracefully closing worker [PID: ${process.pid}]...`);
      server.close(() => {
        console.log(`> Worker [PID: ${process.pid}] closed safely.`);
        process.exit(0);
      });

      // Force exit if connections do not close within 5 seconds
      setTimeout(() => {
        console.error(`> Forcing worker shutdown after timeout [PID: ${process.pid}].`);
        process.exit(1);
      }, 5000).unref();
    };

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));
  })
  .catch((err) => {
    console.error("Failed to start aMenuVerse Next.js server:", err);
    process.exit(1);
  });
