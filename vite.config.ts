/// <reference types="vitest/config" />
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Read package.json at config-load time (in Node) so the UI can show the
// app version without bundling the whole manifest.
const pkg = JSON.parse(
  readFileSync(fileURLToPath(new URL("./package.json", import.meta.url)), "utf-8"),
) as { version: string };

export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  server: {
    port: 5181,
    host: true,
    // Docker Desktop bind mounts don't always deliver fs events on macOS.
    watch: process.env.VITE_POLL ? { usePolling: true, interval: 300 } : undefined,
  },
  preview: { port: 5181, host: true },
  build: { outDir: "dist", sourcemap: true },
  test: {
    environment: "jsdom",
    include: ["tests/**/*.test.ts"],
  },
});
