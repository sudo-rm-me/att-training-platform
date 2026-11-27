import { defineConfig } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    alias: {
      // Next.js-only guard; harmless to stub in tests.
      "server-only": path.resolve(root, "tests/support/empty.ts"),
    },
  },
  test: {
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
    environment: "node",
    env: {
      // Each test file gets its own throwaway in-memory Postgres (PGlite).
      DATABASE_URL: "pglite:memory://",
      APP_TIMEZONE: "Europe/London",
    },
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
