import "server-only";
import { cache } from "react";
import { and, asc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { assignments, attempts, courses, users, type Assignment, type User } from "@/db/schema";
import { listCatalog, type CatalogCourse } from "@/lib/courses";
import type { Scope } from "@/lib/teams";

export const DUE_SOON_DAYS = 7;
/** Recurring training: start nudging this many days before a pass expires. */
export const RENEW_WINDOW_DAYS = 30;
const DAY = 86_400_000;

/**
 * done     – complete (and still valid, for recurring training)
 * renew    – complete, but the pass expires soon: retake to renew
 * overdue  – not complete and past its due date (or the pass expired)
 * due_soon – not complete, due within a week
 * open     – not complete, no pressure yet
 */
export type DueState = "done" | "renew" | "overdue" | "due_soon" | "open";

/** Counts as complete for compliance figures. */
export const isCompliant = (s: DueState) => s === "done" || s === "renew";

export function dueState(dueAt: Date | null, done: boolean, now = new Date()): DueState {
  if (done) return "done";
  if (!dueAt) return "open";
  if (dueAt.getTime() < now.getTime()) return "overdue";
  if (dueAt.getTime() - now.getTime() < DUE_SOON_DAYS * DAY) return "due_soon";
  return "open";
}

export function addMonths(d: Date, months: number) {
  const x = new Date(d);
  const day = x.getUTCDate();
  x.setUTCMonth(x.getUTCMonth() + months);
  // Clamp e.g. 31 Jan + 1 month to the end of February.
  if (x.getUTCDate() < day) x.setUTCDate(0);
  return x;
}

export type Requirement = { dueAt: Date | null; recurMonths: number | null; note: string | null };
export type RequirementStatus = {
  state: DueState;
  /** The date that matters now: due date, or when the current pass expires. */
  dueAt: Date | null;
  /** When the latest pass stops counting (recurring training only). */
  validUntil: Date | null;
};

/** Where someone stands on one requirement, given their most recent pass. */
export function requirementStatus(req: Pick<Requirement, "dueAt" | "recurMonths">, lastPass: Date | null, now = new Date()): RequirementStatus {
  if (lastPass) {
    if (!req.recurMonths) return { state: "done", dueAt: null, validUntil: null };
    const validUntil = addMonths(lastPass, req.recurMonths);
    if (validUntil.getTime() <= now.getTime()) return { state: "overdue", dueAt: validUntil, validUntil };
    const renewSoon = validUntil.getTime() - now.getTime() < RENEW_WINDOW_DAYS * DAY;
    return { state: renewSoon ? "renew" : "done", dueAt: validUntil, validUntil };
  }
  return { state: dueState(req.dueAt, false, now), dueAt: req.dueAt, validUntil: null };
}

/** Human label for a status chip. */
export function statusText(st: RequirementStatus, now = new Date()) {
  switch (st.state) {
    case "done":
      return st.validUntil ? `Done · valid to ${shortDate(st.validUntil)}` : "Completed";
    case "renew":
      return `Renew by ${shortDate(st.validUntil!)}`;
    case "overdue":
      return st.validUntil ? `Expired ${shortDate(st.validUntil)}` : dueText(st.dueAt, now);
    default:
      return dueText(st.dueAt, now);
  }
}

function shortDate(d: Date) {
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: process.env.APP_TIMEZONE || "Europe/London" });
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
  const out = new Map<string, Requirement>();
  for (const a of all) {
    if (!appliesTo(a, u)) continue;
    const prev = out.get(a.courseId);
    if (!prev) {
      out.set(a.courseId, { dueAt: a.dueAt, note: a.note, recurMonths: a.recurMonths });
      continue;
    }
    // Strictest wins: earliest due date, shortest renewal period.
    if (a.dueAt && (!prev.dueAt || a.dueAt < prev.dueAt)) {
      prev.dueAt = a.dueAt;
      prev.note = a.note ?? prev.note;
    }
    if (a.recurMonths && (!prev.recurMonths || a.recurMonths < prev.recurMonths)) prev.recurMonths = a.recurMonths;
  }
  return out;
}

/** Most recent pass per "userId:courseId". */
export async function latestPasses(userIds: string[]) {
  const out = new Map<string, Date>();
  if (userIds.length === 0) return out;
  const db = await getDb();
  const rows = await db
    .select({ userId: attempts.userId, courseId: attempts.courseId, at: sql<Date>`max(${attempts.completedAt})`.mapWith((v) => new Date(v)) })
    .from(attempts)
    .where(and(inArray(attempts.userId, userIds), eq(attempts.passed, true)))
    .groupBy(attempts.userId, attempts.courseId);
  for (const r of rows) out.set(`${r.userId}:${r.courseId}`, r.at);
  return out;
}

export type MyAssignment = {
  course: CatalogCourse;
  dueAt: Date | null;
  note: string | null;
  recurMonths: number | null;
  validUntil: Date | null;
  state: DueState;
  text: string;
};

const ORDER: Record<DueState, number> = { overdue: 0, due_soon: 1, renew: 2, open: 3, done: 4 };

/** The signed-in user's assigned courses, most urgent first. */
export const getMyAssignments = cache(
  async (userId: string, department: string | null, teamId: string | null): Promise<MyAssignment[]> => {
  const [all, catalog, passes] = await Promise.all([publishedAssignments(), listCatalog(userId), latestPasses([userId])]);
  const mine = mergeForUser(all, { id: userId, department, teamId });
  const now = new Date();
  return catalog
    .filter((c) => mine.has(c.id))
    .map((c) => {
      const req = mine.get(c.id)!;
      const st = requirementStatus(req, passes.get(`${userId}:${c.id}`) ?? null, now);
      return {
        course: c,
        note: req.note,
        recurMonths: req.recurMonths,
        dueAt: st.dueAt,
        validUntil: st.validUntil,
        state: st.state,
        text: statusText(st, now),
      };
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
