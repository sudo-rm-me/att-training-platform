"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/session";
import { runReminders } from "@/lib/reminders";
import { audit } from "@/lib/audit";

export async function runRemindersAction() {
  const me = await requirePermission("admin");
  const s = await runReminders();
  await audit(me, {
    action: "reminders.run",
    summary: `${s.learnerReminders} reminders, ${s.leadDigests} manager digests, ${s.teamPosts} Teams posts`,
    meta: s,
  });
  revalidatePath("/", "layout");
  return {
    ok: true as const,
    message:
      s.learnerReminders + s.leadDigests + s.teamPosts === 0
        ? "Nothing new to send. Everyone already has their latest reminder."
        : `Sent ${s.learnerReminders} reminders, ${s.leadDigests} manager digests and ${s.teamPosts} Teams posts`,
  };
}
