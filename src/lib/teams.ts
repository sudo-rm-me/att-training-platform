import "server-only";
import { cache } from "react";
import { asc, count, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { teamLeads, teams, users, type User } from "@/db/schema";

/** What a person is allowed to manage. */
export type Scope = Pick<User, "id" | "role" | "department"> & {
  /** Teams this person leads (only meaningful for managers). */
  leadTeamIds: string[];
};

export const leadTeamIdsFor = cache(async (userId: string) => {
  const db = await getDb();
  return (await db.select({ t: teamLeads.teamId }).from(teamLeads).where(eq(teamLeads.userId, userId))).map((r) => r.t);
});

export async function scopeFor(u: Pick<User, "id" | "role" | "department">): Promise<Scope> {
  return { id: u.id, role: u.role, department: u.department, leadTeamIds: u.role === "manager" ? await leadTeamIdsFor(u.id) : [] };
}

export async function listTeams() {
  const db = await getDb();
  const [rows, counts] = await Promise.all([
    db.select().from(teams).orderBy(asc(teams.name)),
    db.select({ teamId: users.teamId, n: count() }).from(users).groupBy(users.teamId),
  ]);
  const byTeam = new Map(counts.map((c) => [c.teamId, c.n]));
  return rows.map((t) => ({ ...t, members: byTeam.get(t.id) ?? 0 }));
}

export async function teamsByIds(ids: string[]) {
  if (ids.length === 0) return [];
  const db = await getDb();
  return db.select().from(teams).where(inArray(teams.id, ids)).orderBy(asc(teams.name));
}

/** Team name per user, for labels (falls back to department). */
export function groupLabel(u: Pick<User, "teamId" | "department">, teamNames: Map<string, string>) {
  return (u.teamId && teamNames.get(u.teamId)) || u.department || null;
}
