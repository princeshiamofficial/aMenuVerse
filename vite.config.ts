import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";

process.env.NITRO_PRESET = "node-server";

export default defineConfig(({ command }) => ({
  css: {
    transformer: "lightningcss",
  },
  resolve: {
    tsconfigPaths: true,
    alias: {
      "@": path.resolve(process.cwd(), "./src"),
    },
    dedupe: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "@tanstack/react-query",
      "@tanstack/query-core",
    ],
  },
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "react-dom/client",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
    ],
    ignoreOutdatedRequests: true,
  },
  plugins: [
    tanstackStart({
      importProtection: {
        behavior: "error",
        client: {
          files: ["**/server/**"],
          specifiers: ["server-only"],
        },
      },
      server: { entry: "./src/server.ts" },
    }),
    ...(command === "build" ? [nitro()] : []),
    react(),
    tailwindcss(),
  ],
  server: {
    host: true,
    allowedHosts: true,
  },
}));
