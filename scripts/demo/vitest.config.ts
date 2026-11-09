// The demo seed lives outside src/, which the main config's `include` never reaches, so it gets its own config.
// Standalone on purpose: merging the main one would append its jsdom setup and every src test. It loads .env itself,
// because the seed reads the Supabase address from process.env.
import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";
import path from "node:path";

const root = path.resolve(__dirname, "../..");

export default defineConfig({
  test: {
    root,
    environment: "node",
    include: ["scripts/demo/seed.test.ts"],
    env: loadEnv("", root, ""),
  },
  resolve: { alias: { "@": path.join(root, "src") } },
});
