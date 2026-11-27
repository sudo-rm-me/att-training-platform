import "server-only";
import { cache } from "react";
import { and, asc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { assignments, attempts, courses, users, type Assignment, type User } from "@/db/schema";
import { listCatalog, type CatalogCourse } from "@/lib/courses";

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

const sameDept = (a: string | null | undefined, b: string | null | undefined) =>
  !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();

/** Does this assignment apply to this person? */
export function appliesTo(a: Pick<Assignment, "targetType" | "targetUserId" | "targetDepartment">, u: Pick<User, "id" | "department">) {
  if (a.targetType === "everyone") return true;
  if (a.targetType === "user") return a.targetUserId === u.id;
  return sameDept(a.targetDepartment, u.department);
}

/** Can `me` manage (assign to / view progress of) `target`? */
export function canManageUser(me: Pick<User, "role" | "department">, target: Pick<User, "department">) {
  if (me.role === "admin") return true;
  return me.role === "manager" && sameDept(me.department, target.department);
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
export function mergeForUser(all: Assignment[], u: Pick<User, "id" | "department">) {
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
export const getMyAssignments = cache(async (userId: string, department: string | null): Promise<MyAssignment[]> => {
  const [all, catalog] = await Promise.all([publishedAssignments(), listCatalog(userId)]);
  const mine = mergeForUser(all, { id: userId, department });
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
});

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

/** People `me` can manage: admins see everyone (optionally filtered), managers see their department. */
export async function managedPeople(me: Pick<User, "role" | "department">, department?: string | null) {
  const db = await getDb();
  const dept = me.role === "admin" ? department : me.department;
  if (me.role !== "admin" && !dept) return [];
  return db
    .select()
    .from(users)
    .where(dept ? sql`lower(trim(${users.department})) = lower(trim(${dept}))` : undefined)
    .orderBy(asc(users.name))
    .limit(2000);
}
