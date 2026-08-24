import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { createClient } = require("redis");

async function main() {
  const client = createClient({
    url: process.env.REDIS_URL || "redis://localhost:6379",
  });

  try {
    await client.connect();
    // Disable write-blocking on save failure
    await client.sendCommand(["CONFIG", "SET", "stop-writes-on-bgsave-error", "no"]);
    console.log("Disabled stop-writes-on-bgsave-error successfully.");

    const keys = await client.keys("tenant:*:data");
    console.log("Found tenant cache keys:", keys);
    for (const key of keys) {
      await client.del(key);
      console.log("Deleted key:", key);
    }
  } catch (err) {
    console.error("Error connecting or running Redis operations:", err);
  } finally {
    await client.quit();
  }
  console.log("Redis cache clean finished!");
}

main().catch(console.error);
