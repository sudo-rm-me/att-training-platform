import "server-only";
import { cache } from "react";
import { and, asc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { assignments, attempts, courses, users, type Assignment, type User } from "@/db/schema";
import { listCatalog, type CatalogCourse } from "@/lib/courses";
import type { Scope } from "@/lib/teams";

export const DUE_SOON_DAYS = 7;
const DAY = 86_400_000;

export type DueState = "done" | "overdue" | "due_soon" | "open";

export function dueState(dueAt: Date | null, done: boolean, now = new Date()): DueState {
  if (done) return "done";
  if (!dueAt) return "open";
  if (dueAt.getTime() < now.getTime()) return "overdue";
  if (dueAt.getTime() - now.getTime() < DUE_SOON_DAYS * DAY) return "due_soon";
  return "open";
}

/** "Due in 3 days", "Overdue by 2 days", "Due today" */
export function dueText(dueAt: Date | null, now = new Date()): string {
  if (!dueAt) return "No due date";
  const days = Math.round((startOfDay(dueAt) - startOfDay(now)) / DAY);
  if (days === 0) return dueAt < now ? "Due today (overdue)" : "Due today";
  if (days === 1) return "Due tomorrow";
  if (days > 1) return `Due in ${days} days`;
  if (days === -1) return "Overdue by 1 day";
  return `Overdue by ${-days} days`;
}

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

export const sameDept = (a: string | null | undefined, b: string | null | undefined) =>
  !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();

/** Does this assignment apply to this person? */
export type Member = Pick<User, "id" | "department" | "teamId">;

export function appliesTo(
  a: Pick<Assignment, "targetType" | "targetUserId" | "targetDepartment" | "targetTeamId">,
  u: Member,
) {
  switch (a.targetType) {
    case "everyone":
      return true;
    case "user":
      return a.targetUserId === u.id;
    case "team":
      return !!u.teamId && a.targetTeamId === u.teamId;
    case "department":
      return sameDept(a.targetDepartment, u.department);
  }
}

/**
 * Can `me` manage (assign to / view progress of) `target`?
 * Admins: everyone. Managers: members of the teams they lead, or, if they
 * lead no teams, people in their own department.
 */
export function canManageUser(me: Pick<Scope, "role" | "department" | "leadTeamIds">, target: Pick<User, "department" | "teamId">) {
  if (me.role === "admin") return true;
  if (me.role !== "manager") return false;
  if (me.leadTeamIds.length) return !!target.teamId && me.leadTeamIds.includes(target.teamId);
  return sameDept(me.department, target.department);
}

/**
 * May `me` create or remove an assignment with this target?
 * `targetUser` is the assigned person (only needed for "user" targets).
 */
export function canTarget(
  me: Pick<Scope, "role" | "department" | "leadTeamIds">,
  a: Pick<Assignment, "targetType" | "targetDepartment" | "targetTeamId">,
  targetUser?: Pick<User, "department" | "teamId"> | null,
) {
  if (me.role === "admin") return true;
  if (me.role !== "manager") return false;
  switch (a.targetType) {
    case "everyone":
      return false;
    case "team":
      return !!a.targetTeamId && me.leadTeamIds.includes(a.targetTeamId);
    case "department":
      return me.leadTeamIds.length === 0 && sameDept(a.targetDepartment, me.department);
    case "user":
      return !!targetUser && canManageUser(me, targetUser);
  }
}

/** All assignments for published courses, oldest first. */
export async function publishedAssignments() {
  const db = await getDb();
  return db
    .select({ a: assignments })
    .from(assignments)
    .innerJoin(courses, eq(courses.id, assignments.courseId))
    .where(eq(courses.status, "published"))
    .orderBy(asc(assignments.createdAt))
    .then((r) => r.map((x) => x.a));
}

/** Effective (merged) assignment per course for a user: the earliest due date wins. */
export function mergeForUser(all: Assignment[], u: Member) {
  const out = new Map<string, { dueAt: Date | null; note: string | null }>();
  for (const a of all) {
    if (!appliesTo(a, u)) continue;
    const prev = out.get(a.courseId);
    if (!prev) out.set(a.courseId, { dueAt: a.dueAt, note: a.note });
    else if (a.dueAt && (!prev.dueAt || a.dueAt < prev.dueAt)) out.set(a.courseId, { dueAt: a.dueAt, note: a.note ?? prev.note });
  }
  return out;
}

/** (userId, courseId) pairs with at least one passed attempt. */
export async function passedPairs(userIds: string[]) {
  const set = new Set<string>();
  if (userIds.length === 0) return set;
  const db = await getDb();
  const rows = await db
    .selectDistinct({ userId: attempts.userId, courseId: attempts.courseId })
    .from(attempts)
    .where(and(inArray(attempts.userId, userIds), eq(attempts.passed, true)));
  for (const r of rows) set.add(`${r.userId}:${r.courseId}`);
  return set;
}

export type MyAssignment = {
  course: CatalogCourse;
  dueAt: Date | null;
  note: string | null;
  state: DueState;
};

const ORDER: Record<DueState, number> = { overdue: 0, due_soon: 1, open: 2, done: 3 };

/** The signed-in user's assigned courses, most urgent first. */
export const getMyAssignments = cache(
  async (userId: string, department: string | null, teamId: string | null): Promise<MyAssignment[]> => {
  const [all, catalog] = await Promise.all([publishedAssignments(), listCatalog(userId)]);
  const mine = mergeForUser(all, { id: userId, department, teamId });
  const now = new Date();
  return catalog
    .filter((c) => mine.has(c.id))
    .map((c) => {
      const m = mine.get(c.id)!;
      return { course: c, ...m, state: dueState(m.dueAt, c.progress.status === "completed", now) };
    })
    .sort(
      (a, b) =>
        ORDER[a.state] - ORDER[b.state] ||
        (a.dueAt?.getTime() ?? Infinity) - (b.dueAt?.getTime() ?? Infinity),
    );
  },
);

/** Distinct non-empty departments, alphabetical. */
export async function listDepartments() {
  const db = await getDb();
  const rows = await db
    .selectDistinct({ d: users.department })
    .from(users)
    .where(and(isNotNull(users.department), sql`trim(${users.department}) <> ''`))
    .orderBy(asc(users.department));
  return rows.map((r) => r.d!);
}

/**
 * People `me` can manage, optionally narrowed to one team or department.
 * Managers only ever get people inside their scope, whatever the filter says.
 */
export async function managedPeople(me: Scope, filter: { teamId?: string | null; department?: string | null } = {}) {
  const db = await getDb();
  const byDept = (d: string) => sql`lower(trim(${users.department})) = lower(trim(${d}))`;
  let where;
  if (me.role === "admin") {
    where = filter.teamId ? eq(users.teamId, filter.teamId) : filter.department ? byDept(filter.department) : undefined;
  } else if (me.role === "manager" && me.leadTeamIds.length) {
    const ids = filter.teamId && me.leadTeamIds.includes(filter.teamId) ? [filter.teamId] : me.leadTeamIds;
    where = inArray(users.teamId, ids);
  } else if (me.role === "manager" && me.department?.trim()) {
    where = byDept(me.department);
  } else {
    return [];
  }
  return db.select().from(users).where(where).orderBy(asc(users.name)).limit(5000);
}
