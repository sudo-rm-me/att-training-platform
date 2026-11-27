"use server";

import { revalidatePath } from "next/cache";
import { and, eq, ne, count } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { roleEnum, users } from "@/db/schema";
import { requirePermission } from "@/lib/session";

const input = z.object({ userId: z.uuid(), role: z.enum(roleEnum.enumValues) });

export async function setUserRole(userId: string, role: string) {
  await requirePermission("admin");
  const parsed = input.parse({ userId, role });
  const db = await getDb();

  if (parsed.role !== "admin") {
    const [{ admins }] = await db
      .select({ admins: count() })
      .from(users)
      .where(and(eq(users.role, "admin"), ne(users.id, parsed.userId)));
    if (admins === 0) return { ok: false as const, error: "There must be at least one admin." };
  }

  await db.update(users).set({ role: parsed.role }).where(eq(users.id, parsed.userId));
  revalidatePath("/admin/users");
  return { ok: true as const };
}
