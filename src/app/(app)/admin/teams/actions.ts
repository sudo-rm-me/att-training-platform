"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { teamLeads, teams, users } from "@/db/schema";
import { requirePermission } from "@/lib/session";
import { audit } from "@/lib/audit";

type Result = { ok: true; message: string } | { ok: false; error: string };

const teamInput = z.object({
  name: z.string().trim().min(1, "Give the team a name.").max(80),
  icon: z.string().trim().min(1).max(8).default("👥"),
  description: z.string().trim().max(300).default(""),
});

function refresh(teamId?: string) {
  revalidatePath("/admin/teams");
  if (teamId) revalidatePath(`/admin/teams/${teamId}`);
  revalidatePath("/admin/users");
  revalidatePath("/team");
  revalidatePath("/leaderboard");
}

async function nameTaken(name: string, exceptId?: string) {
  const db = await getDb();
  const [row] = await db
    .select({ id: teams.id })
    .from(teams)
    .where(sql`lower(${teams.name}) = lower(${name})`)
    .limit(1);
  return !!row && row.id !== exceptId;
}

export async function createTeamAction(raw: { name: string; icon?: string; description?: string }): Promise<Result & { id?: string }> {
  const me = await requirePermission("admin");
  const parsed = teamInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  if (await nameTaken(parsed.data.name)) return { ok: false, error: "A team with that name already exists." };
  const db = await getDb();
  const [t] = await db.insert(teams).values(parsed.data).returning();
  await audit(me, { action: "team.create", summary: t.name, targetType: "team", targetId: t.id });
  refresh();
  return { ok: true, message: `Team “${t.name}” created`, id: t.id };
}

export async function updateTeamAction(teamId: string, raw: { name: string; icon?: string; description?: string }): Promise<Result> {
  const me = await requirePermission("admin");
  const id = z.uuid().parse(teamId);
  const parsed = teamInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  if (await nameTaken(parsed.data.name, id)) return { ok: false, error: "A team with that name already exists." };
  const db = await getDb();
  const [t] = await db.update(teams).set(parsed.data).where(eq(teams.id, id)).returning();
  if (!t) return { ok: false, error: "Team not found." };
  await audit(me, { action: "team.update", summary: t.name, targetType: "team", targetId: t.id });
  refresh(id);
  return { ok: true, message: "Team saved" };
}

export async function deleteTeamAction(teamId: string) {
  const me = await requirePermission("admin");
  const id = z.uuid().parse(teamId);
  const db = await getDb();
  const [t] = await db.delete(teams).where(eq(teams.id, id)).returning();
  if (t) await audit(me, { action: "team.delete", summary: `${t.name} (members kept, now without a team)`, targetType: "team", targetId: id });
  refresh();
  redirect("/admin/teams");
}

/** Move people into a team (or out of any team when teamId is null). */
export async function setMembersAction(userIds: string[], teamId: string | null): Promise<Result> {
  const me = await requirePermission("admin");
  const ids = z.array(z.uuid()).min(1).max(1000).parse(userIds);
  const tid = teamId === null ? null : z.uuid().parse(teamId);
  const db = await getDb();
  let teamName = "no team";
  if (tid) {
    const [t] = await db.select().from(teams).where(eq(teams.id, tid));
    if (!t) return { ok: false, error: "Team not found." };
    teamName = t.name;
  }
  const moved = await db.update(users).set({ teamId: tid }).where(inArray(users.id, ids)).returning({ name: users.name });
  const names = moved.map((m) => m.name);
  await audit(me, {
    action: "team.members",
    summary: `${names.slice(0, 5).join(", ")}${names.length > 5 ? ` and ${names.length - 5} more` : ""} → ${teamName}`,
    targetType: "team",
    targetId: tid ?? undefined,
    meta: { userIds: ids },
  });
  refresh(tid ?? undefined);
  return { ok: true, message: tid ? `Moved ${moved.length} ${moved.length === 1 ? "person" : "people"} to ${teamName}` : "Removed from team" };
}

/** Add everyone from an Entra department who isn't in a team yet. */
export async function addDepartmentAction(teamId: string, department: string): Promise<Result> {
  await requirePermission("admin");
  const tid = z.uuid().parse(teamId);
  const dept = z.string().trim().min(1).parse(department);
  const db = await getDb();
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(and(isNull(users.teamId), sql`lower(trim(${users.department})) = lower(trim(${dept}))`));
  if (rows.length === 0) return { ok: false, error: `Everyone in ${dept} is already in a team.` };
  return setMembersAction(
    rows.map((r) => r.id),
    tid,
  );
}

/** Make someone a team lead (promoting learners to manager) or remove them as lead. */
export async function setLeadAction(teamId: string, userId: string, lead: boolean): Promise<Result> {
  const me = await requirePermission("admin");
  const tid = z.uuid().parse(teamId);
  const uid = z.uuid().parse(userId);
  const db = await getDb();
  const [[t], [u]] = await Promise.all([
    db.select().from(teams).where(eq(teams.id, tid)),
    db.select().from(users).where(eq(users.id, uid)),
  ]);
  if (!t || !u) return { ok: false, error: "Not found." };

  if (lead) {
    await db.insert(teamLeads).values({ teamId: tid, userId: uid }).onConflictDoNothing();
    // Leads need manager access. Learners are promoted automatically; authors keep
    // their role (a person has one role), so the message below flags it instead.
    if (u.role === "learner") {
      await db.update(users).set({ role: "manager" }).where(eq(users.id, uid));
      await audit(me, {
        action: "role.change",
        summary: `${u.name}: learner → manager (made lead of ${t.name})`,
        targetType: "user",
        targetId: uid,
        meta: { from: "learner", to: "manager" },
      });
    }
  } else {
    await db.delete(teamLeads).where(and(eq(teamLeads.teamId, tid), eq(teamLeads.userId, uid)));
  }
  await audit(me, {
    action: "team.lead",
    summary: `${u.name} ${lead ? "now leads" : "no longer leads"} ${t.name}`,
    targetType: "team",
    targetId: tid,
  });
  refresh(tid);
  const note = lead && u.role === "author" ? ` ${u.name} is an author, so they'll need the manager or admin role to see the team.` : "";
  return { ok: true, message: `${u.name} ${lead ? "is now a lead" : "is no longer a lead"}.${note}` };
}

/** One team per Entra department; people without a team join theirs. */
export async function teamsFromDepartmentsAction(): Promise<Result> {
  const me = await requirePermission("admin");
  const db = await getDb();
  const depts = (
    await db
      .selectDistinct({ d: sql<string>`trim(${users.department})` })
      .from(users)
      .where(sql`${users.department} is not null and trim(${users.department}) <> ''`)
  ).map((r) => r.d);
  let created = 0;
  let moved = 0;
  for (const d of depts) {
    let [t] = await db
      .select()
      .from(teams)
      .where(sql`lower(${teams.name}) = lower(${d})`)
      .limit(1);
    if (!t) {
      [t] = await db.insert(teams).values({ name: d, icon: "🏢" }).returning();
      created++;
    }
    const r = await db
      .update(users)
      .set({ teamId: t.id })
      .where(and(isNull(users.teamId), sql`lower(trim(${users.department})) = lower(${d})`))
      .returning({ id: users.id });
    moved += r.length;
  }
  await audit(me, { action: "team.create", summary: `Created ${created} teams from departments; placed ${moved} people` });
  refresh();
  if (depts.length === 0) return { ok: false, error: "Nobody has a department yet. Departments come from Microsoft Entra at sign-in." };
  return { ok: true, message: `Created ${created} ${created === 1 ? "team" : "teams"} and placed ${moved} ${moved === 1 ? "person" : "people"}` };
}
