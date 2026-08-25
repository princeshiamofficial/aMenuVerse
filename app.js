import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

// Automatically load .env, .env.local, and .env.production into process.env
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

const outputServerEntry = path.resolve(process.cwd(), ".output/server/index.mjs");
const entryUrl = pathToFileURL(outputServerEntry).href;

import(entryUrl).catch((err) => {
  console.error("Failed to start aMenuVerse server from .output/server/index.mjs:", err);
  process.exit(1);
});
