import "server-only";
import path from "node:path";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

export type DB = NodePgDatabase<typeof schema>;

type Holder = { db?: DB; ready?: Promise<void> };
const g = globalThis as unknown as { __attDb?: Holder };
const holder: Holder = (g.__attDb ??= {});

const MIGRATIONS = path.join(process.cwd(), "drizzle");

/**
 * DATABASE_URL=postgres://...  -> node-postgres pool (production / docker-compose)
 * DATABASE_URL unset or pglite:<dir> -> embedded PGlite (zero-install local dev)
 */
function create(): { db: DB; ready: Promise<void> } {
  const url = process.env.DATABASE_URL ?? "pglite:./.data/pglite";

  if (url.startsWith("pglite:")) {
    if (process.env.NODE_ENV === "production" && !process.env.ALLOW_PGLITE) {
      throw new Error("DATABASE_URL must point to PostgreSQL in production");
    }
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PGlite } = require("@electric-sql/pglite") as typeof import("@electric-sql/pglite");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { drizzle } = require("drizzle-orm/pglite") as typeof import("drizzle-orm/pglite");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { migrate } = require("drizzle-orm/pglite/migrator") as typeof import("drizzle-orm/pglite/migrator");
    const dir = path.resolve(url.slice("pglite:".length));
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    (require("node:fs") as typeof import("node:fs")).mkdirSync(dir, { recursive: true });
    const client = new PGlite(dir);
    const db = drizzle(client, { schema });
    const ready = migrate(db, { migrationsFolder: MIGRATIONS });
    return { db: db as unknown as DB, ready };
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Pool } = require("pg") as typeof import("pg");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { drizzle } = require("drizzle-orm/node-postgres") as typeof import("drizzle-orm/node-postgres");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { migrate } = require("drizzle-orm/node-postgres/migrator") as typeof import("drizzle-orm/node-postgres/migrator");
  const pool = new Pool({
    connectionString: url,
    max: Number(process.env.DATABASE_POOL_MAX ?? 10),
    // Prefer ?sslmode=require in the URL; DATABASE_SSL=true forces TLS otherwise.
    ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: true } : undefined,
  });
  const db = drizzle(pool, { schema });
  const ready =
    process.env.RUN_MIGRATIONS === "false" ? Promise.resolve() : migrate(db, { migrationsFolder: MIGRATIONS });
  return { db, ready };
}

function init() {
  if (!holder.db) {
    const { db, ready } = create();
    holder.db = db;
    holder.ready = ready.catch((err) => {
      console.error("Database migration failed", err);
      // Allow the next request to retry from scratch.
      holder.db = undefined;
      holder.ready = undefined;
      throw err;
    });
  }
  return holder as Required<Holder>;
}

type DevHolder = Holder & { journalMtime?: number };

/** In development, pick up newly generated migrations without a restart. */
async function devRemigrate(h: Required<Holder>) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs = require("node:fs") as typeof import("node:fs");
  const journal = path.join(MIGRATIONS, "meta", "_journal.json");
  const mtime = fs.statSync(journal).mtimeMs;
  const dh = holder as DevHolder;
  if (dh.journalMtime === undefined) {
    dh.journalMtime = mtime;
    return;
  }
  if (dh.journalMtime === mtime) return;
  dh.journalMtime = mtime;
  const url = process.env.DATABASE_URL ?? "pglite:./.data/pglite";
  const mod = url.startsWith("pglite:") ? "drizzle-orm/pglite/migrator" : "drizzle-orm/node-postgres/migrator";
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { migrate } = require(mod) as { migrate: (db: unknown, o: { migrationsFolder: string }) => Promise<void> };
  h.ready = migrate(h.db, { migrationsFolder: MIGRATIONS });
}

/** Returns the database once migrations have been applied. */
export async function getDb(): Promise<DB> {
  const h = init();
  if (process.env.NODE_ENV === "development") await devRemigrate(h);
  await h.ready;
  return h.db;
}

export { schema };
