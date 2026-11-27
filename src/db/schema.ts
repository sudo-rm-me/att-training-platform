import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("role", ["learner", "manager", "author", "admin"]);
export type Role = (typeof roleEnum.enumValues)[number];

/** Avatar configuration: one selected item id per layer, plus colours. */
export type AvatarConfig = {
  skin: string;
  hair: string;
  hairColor: string;
  eyes: string;
  brows: string;
  mouth: string;
  top: string;
  topColor: string;
  accessory: string;
  background: string;
};

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Entra object id (oid claim). Null for local dev accounts. */
    entraOid: text("entra_oid").unique(),
    email: text("email").notNull().unique(),
    name: text("name").notNull(),
    department: text("department"),
    jobTitle: text("job_title"),
    role: roleEnum("role").notNull().default("learner"),
    /** Lifetime XP (drives level). */
    xp: integer("xp").notNull().default(0),
    /** Spendable points (shop currency). */
    coins: integer("coins").notNull().default(0),
    avatar: jsonb("avatar").$type<AvatarConfig>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("users_department_idx").on(t.department)],
);

export type User = typeof users.$inferSelect;
