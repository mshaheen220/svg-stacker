/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
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
