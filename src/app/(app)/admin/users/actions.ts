"use server";

import { revalidatePath } from "next/cache";
import { and, eq, ne, count } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { roleEnum, users } from "@/db/schema";
import { requirePermission } from "@/lib/session";
import { audit } from "@/lib/audit";

const input = z.object({ userId: z.uuid(), role: z.enum(roleEnum.enumValues) });

export async function setUserRole(userId: string, role: string) {
  const me = await requirePermission("admin");
  const parsed = input.parse({ userId, role });
  const db = await getDb();

  if (parsed.role !== "admin") {
    const [{ admins }] = await db
      .select({ admins: count() })
      .from(users)
      .where(and(eq(users.role, "admin"), ne(users.id, parsed.userId)));
    if (admins === 0) return { ok: false as const, error: "There must be at least one admin." };
  }

  const [target] = await db.select().from(users).where(eq(users.id, parsed.userId)).limit(1);
  if (!target) return { ok: false as const, error: "User not found." };
  if (target.role === parsed.role) return { ok: true as const };
  await db.update(users).set({ role: parsed.role }).where(eq(users.id, parsed.userId));
  await audit(me, {
    action: "role.change",
    summary: `${target.name}: ${target.role} → ${parsed.role}`,
    targetType: "user",
    targetId: target.id,
    meta: { from: target.role, to: parsed.role, email: target.email },
  });
  revalidatePath("/admin/users");
  return { ok: true as const };
}
