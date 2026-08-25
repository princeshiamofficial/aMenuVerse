// server.js - Hostinger / cPanel Entry Point Wrapper for aMenuVerse
// This wrapper allows Hostinger Node.js selector to point directly to "server.js"

import path from "node:path";
import { pathToFileURL } from "node:url";

const outputServerEntry = path.resolve(process.cwd(), ".output/server/index.mjs");
const entryUrl = pathToFileURL(outputServerEntry).href;

import(entryUrl).catch((err) => {
  console.error("Failed to start aMenuVerse server from .output/server/index.mjs:", err);
  process.exit(1);
});
