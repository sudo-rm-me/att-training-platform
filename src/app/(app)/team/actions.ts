"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { requireUser, can } from "@/lib/session";
import { canManageUser, managedPeople } from "@/lib/assignments";
import { scopeFor } from "@/lib/teams";
import { sendNudges, snapshot } from "@/lib/reminders";
import { audit } from "@/lib/audit";

type Result = { ok: true; message: string } | { ok: false; error: string };

async function nudge(me: Awaited<ReturnType<typeof requireUser>>, people: Awaited<ReturnType<typeof managedPeople>>, onlyOverdue: boolean): Promise<Result> {
  const now = new Date();
  const { byUser } = await snapshot(now, people);
  const targets = people.flatMap((u) =>
    (byUser.get(u.id)?.open ?? [])
      .filter((i) => (onlyOverdue ? i.st.state === "overdue" : true))
      .map((i) => ({ user: u, courseId: i.courseId, title: i.title, text: i.text })),
  );
  if (targets.length === 0) return { ok: false, error: onlyOverdue ? "Nobody has overdue training. 🎉" : "Nothing left to do here." };
  const r = await sendNudges(me, targets, now);
  if (r.sent === 0) return { ok: false, error: "Already nudged today. Try again tomorrow." };
  await audit(me, {
    action: "assignment.nudge",
    summary: `${r.people === 1 ? people.find((p) => targets.some((t) => t.user.id === p.id))!.name : `${r.people} people`}: ${r.sent} ${r.sent === 1 ? "course" : "courses"}`,
    meta: { userIds: [...new Set(targets.map((t) => t.user.id))] },
  });
  revalidatePath("/team");
  return { ok: true, message: `Nudged ${r.people} ${r.people === 1 ? "person" : "people"}${r.skipped ? ` (${r.skipped} already nudged today)` : ""}` };
}

export async function nudgeUserAction(userId: string): Promise<Result> {
  const me = await requireUser();
  if (!can.manage(me.role)) return { ok: false, error: "Only managers can send nudges." };
  const id = z.uuid().safeParse(userId);
  if (!id.success) return { ok: false, error: "Not found." };
  const db = await getDb();
  const [u] = await db.select().from(users).where(eq(users.id, id.data));
  if (!u || !canManageUser(await scopeFor(me), u)) return { ok: false, error: "You can only nudge your own people." };
  return nudge(me, [u], false);
}

export async function nudgeOverdueAction(filter: { teamId?: string | null; department?: string | null }): Promise<Result> {
  const me = await requireUser();
  if (!can.manage(me.role)) return { ok: false, error: "Only managers can send nudges." };
  const f = z.object({ teamId: z.uuid().nullish(), department: z.string().max(200).nullish() }).parse(filter);
  const people = await managedPeople(await scopeFor(me), f);
  return nudge(me, people, true);
}
