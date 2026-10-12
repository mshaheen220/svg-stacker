/// <reference types="vitest/config" />
import type { IncomingMessage, ServerResponse } from "node:http";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { tipsPayload } from "./src/tips";

/**
 * GET /api/tips/ for the Mashghal dashboard, without a backend: the dev and
 * preview servers answer it from src/tips.ts, and the build writes the same
 * JSON to dist/api/tips/index.json for nginx to serve (docker/nginx.conf).
 * CORS is open to any origin - the dashboard fetches it from the browser,
 * and it's read-only public data.
 */
function tipsApi(): Plugin {
  const handle = (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const path = req.url?.split("?")[0];
    if (path !== "/api/tips" && path !== "/api/tips/") return next();
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    if (req.method === "OPTIONS") {
      res.statusCode = 204;
      return res.end();
    }
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify(tipsPayload()));
  };
  return {
    name: "svg-stacker-tips-api",
    configureServer: (server) => void server.middlewares.use(handle),
    configurePreviewServer: (server) => void server.middlewares.use(handle),
    generateBundle() {
      this.emitFile({ type: "asset", fileName: "api/tips/index.json", source: JSON.stringify(tipsPayload()) });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), tipsApi()],
  server: {
    port: 5181,
    host: true,
    // Docker Desktop bind mounts don't always deliver fs events on macOS.
    watch: process.env.VITE_POLL ? { usePolling: true, interval: 300 } : undefined,
  },
  preview: { port: 5181, host: true },
  build: {
    outDir: "dist",
    sourcemap: true,
    // The 3D viewer chunk (three.js) is ~0.9 MB but lazy-loaded with the 3D tab.
    chunkSizeWarningLimit: 1000,
  },
  test: {
    environment: "jsdom",
    include: ["tests/**/*.test.ts"],
  },
});
