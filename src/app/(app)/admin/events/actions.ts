"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { events } from "@/db/schema";
import { requirePermission } from "@/lib/session";
import { audit } from "@/lib/audit";

const schema = z.object({
  name: z.string().trim().min(3).max(80),
  description: z.string().trim().max(400),
  emoji: z.string().trim().min(1).max(8),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  xpMultiplier: z.number().int().min(110).max(500),
  teamChallenge: z.boolean(),
});

export async function createEventAction(input: z.infer<typeof schema>) {
  const admin = await requirePermission("admin");
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Check the name, dates and multiplier." };
  const d = parsed.data;
  const startsAt = new Date(d.startsAt);
  const endsAt = new Date(d.endsAt);
  if (endsAt <= startsAt) return { ok: false as const, error: "The event must end after it starts." };
  if (endsAt.getTime() - startsAt.getTime() > 31 * 86_400_000)
    return { ok: false as const, error: "Events can run for up to 31 days." };
  const db = await getDb();
  const [e] = await db
    .insert(events)
    .values({ ...d, startsAt, endsAt, createdBy: admin.id })
    .returning();
  await audit(admin, {
    action: "event.create",
    summary: `Created event "${e.name}" (${e.xpMultiplier / 100}× XP)`,
    targetType: "event",
    targetId: e.id,
  });
  revalidatePath("/", "layout");
  return { ok: true as const, message: `${e.emoji} ${e.name} scheduled` };
}

export async function deleteEventAction(id: string) {
  const admin = await requirePermission("admin");
  const db = await getDb();
  const [e] = await db.delete(events).where(eq(events.id, z.string().uuid().parse(id))).returning();
  if (!e) return { ok: false as const, error: "Event not found." };
  await audit(admin, { action: "event.delete", summary: `Deleted event "${e.name}"`, targetType: "event", targetId: e.id });
  revalidatePath("/", "layout");
  return { ok: true as const, message: "Event deleted" };
}
