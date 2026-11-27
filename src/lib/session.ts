import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { getDb } from "@/db";
import { users, type Role, type User } from "@/db/schema";

/** The signed-in user's DB row (roles are always read fresh from the DB). */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const session = await auth();
  const id = (session?.user as { id?: string } | undefined)?.id;
  if (!id) return null;
  const db = await getDb();
  const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return user ?? null;
});

export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");
  return user;
}

export const can = {
  author: (r: Role) => r === "author" || r === "admin",
  manage: (r: Role) => r === "manager" || r === "admin",
  admin: (r: Role) => r === "admin",
};

export async function requirePermission(p: keyof typeof can): Promise<User> {
  const user = await requireUser();
  if (!can[p](user.role)) redirect("/?denied=1");
  return user;
}
