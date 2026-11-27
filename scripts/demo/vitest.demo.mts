import { defineConfig } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/** Seeds .data/demo for screenshots. Not part of the normal test run. */
export default defineConfig({
  root,
  resolve: {
    tsconfigPaths: true,
    alias: { "server-only": path.resolve(root, "tests/support/empty.ts") },
  },
  test: {
    include: ["scripts/demo/seed.demo.ts"],
    environment: "node",
    env: { DATABASE_URL: "pglite:./.data/demo", APP_TIMEZONE: "Europe/London" },
    testTimeout: 600_000,
    hookTimeout: 120_000,
  },
});
