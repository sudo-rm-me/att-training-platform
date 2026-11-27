"use server";

import { revalidatePath } from "next/cache";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { assignments, courses, users, type Assignment, type User } from "@/db/schema";
import { requireUser, can } from "@/lib/session";
import { canManageUser } from "@/lib/assignments";
import { TZ } from "@/lib/gamification";
import { audit } from "@/lib/audit";

type Result = { ok: true; message: string } | { ok: false; error: string };

const input = z.object({
  courseId: z.uuid(),
  targetType: z.enum(["user", "department", "everyone"]),
  targetUserId: z.uuid().optional(),
  targetDepartment: z.string().trim().min(1).max(200).optional(),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  note: z.string().trim().max(500).optional(),
});
export type AssignmentInput = z.input<typeof input>;

/** 23:59:59 on the given calendar day in the app timezone. */
function endOfDayIn(date: string, tz: string) {
  const [y, m, d] = date.split("-").map(Number);
  const guess = new Date(Date.UTC(y, m - 1, d, 23, 59, 59));
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(guess)
      .map((p) => [p.type, p.value]),
  );
  const asIfUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return new Date(guess.getTime() - (asIfUtc - guess.getTime()));
}

const sameDept = (a?: string | null, b?: string | null) => !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();

/** May `me` create/remove this assignment? */
async function inScope(me: User, a: Pick<Assignment, "targetType" | "targetUserId" | "targetDepartment" | "assignedBy">) {
  if (me.role === "admin") return true;
  if (me.role !== "manager") return false;
  if (a.targetType === "everyone") return false;
  if (a.targetType === "department") return sameDept(a.targetDepartment, me.department);
  const db = await getDb();
  const [u] = await db.select().from(users).where(eq(users.id, a.targetUserId!)).limit(1);
  return !!u && canManageUser(me, u);
}

function refresh() {
  revalidatePath("/assignments");
  revalidatePath("/team");
  revalidatePath("/", "layout");
}

export async function createAssignmentAction(raw: AssignmentInput): Promise<Result> {
  const me = await requireUser();
  if (!can.manage(me.role)) return { ok: false, error: "Only managers and admins can assign training." };
  const parsed = input.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Please check the form and try again." };
  const v = parsed.data;

  const target = {
    targetType: v.targetType,
    targetUserId: v.targetType === "user" ? (v.targetUserId ?? null) : null,
    targetDepartment: v.targetType === "department" ? (v.targetDepartment ?? null) : null,
  };
  if (v.targetType === "user" && !target.targetUserId) return { ok: false, error: "Choose a person." };
  if (v.targetType === "department" && !target.targetDepartment) return { ok: false, error: "Choose a department." };
  if (!(await inScope(me, { ...target, assignedBy: me.id })))
    return { ok: false, error: "You can only assign training to your own team." };

  const db = await getDb();
  const [course] = await db.select().from(courses).where(eq(courses.id, v.courseId)).limit(1);
  if (!course || course.status !== "published") return { ok: false, error: "That course isn't published." };

  const dueAt = v.dueDate ? endOfDayIn(v.dueDate, TZ()) : null;
  if (dueAt && dueAt.getTime() < Date.now()) return { ok: false, error: "The due date can't be in the past." };

  // Re-assigning the same course to the same target just updates the due date.
  const [existing] = await db
    .select()
    .from(assignments)
    .where(
      and(
        eq(assignments.courseId, v.courseId),
        eq(assignments.targetType, target.targetType),
        target.targetUserId ? eq(assignments.targetUserId, target.targetUserId) : isNull(assignments.targetUserId),
        target.targetDepartment ? eq(assignments.targetDepartment, target.targetDepartment) : isNull(assignments.targetDepartment),
      ),
    )
    .limit(1);

  const who =
    target.targetType === "everyone"
      ? "everyone"
      : target.targetType === "department"
        ? target.targetDepartment!
        : ((await db.select({ name: users.name }).from(users).where(eq(users.id, target.targetUserId!)))[0]?.name ?? "a person");
  const auditEntry = {
    summary: `${course.title} → ${who}${dueAt ? ` (due ${v.dueDate})` : ""}`,
    targetType: "course",
    targetId: course.id,
    meta: { ...target, dueAt: dueAt?.toISOString() ?? null },
  };

  if (existing) {
    await db.update(assignments).set({ dueAt, note: v.note || null, assignedBy: me.id }).where(eq(assignments.id, existing.id));
    await audit(me, { action: "assignment.update", ...auditEntry });
    refresh();
    return { ok: true, message: "Assignment updated" };
  }
  await db.insert(assignments).values({ courseId: v.courseId, ...target, dueAt, note: v.note || null, assignedBy: me.id });
  await audit(me, { action: "assignment.create", ...auditEntry });
  refresh();
  return { ok: true, message: `“${course.title}” assigned` };
}

export async function deleteAssignmentAction(id: string): Promise<Result> {
  const me = await requireUser();
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Not found" };
  const db = await getDb();
  const [a] = await db.select().from(assignments).where(eq(assignments.id, id)).limit(1);
  if (!a) return { ok: false, error: "Not found" };
  if (!(await inScope(me, a))) return { ok: false, error: "You can't remove this assignment." };
  await db.delete(assignments).where(eq(assignments.id, id));
  const [c] = await db.select({ title: courses.title }).from(courses).where(eq(courses.id, a.courseId));
  await audit(me, {
    action: "assignment.delete",
    summary: `${c?.title ?? "Course"} → ${a.targetType === "department" ? a.targetDepartment : a.targetType}`,
    targetType: "course",
    targetId: a.courseId,
  });
  refresh();
  return { ok: true, message: "Assignment removed" };
}
