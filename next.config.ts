import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server bundle for the container image.
  output: "standalone",
  // Lets an e2e dev server run alongside the normal one (separate build cache).
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // Native / wasm-backed packages must not be bundled.
  serverExternalPackages: [
    "@electric-sql/pglite",
    "pg",
    "@react-pdf/renderer",
    "@azure/storage-blob",
    "@azure/identity",
  ],
  experimental: {
    serverActions: {
      // Allow .pptx and media uploads through server actions.
      bodySizeLimit: "50mb",
    },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
