import "server-only";
import { getDb, type DB } from "@/db";
import { auditLog, type User } from "@/db/schema";

type Tx = Pick<DB, "insert">;

export type AuditInput = {
  action: string;
  summary: string;
  targetType?: string;
  targetId?: string;
  meta?: Record<string, unknown>;
};

export const AUDIT_ACTIONS: Record<string, string> = {
  "role.change": "Role changed",
  "course.create": "Course created",
  "course.import": "Course imported",
  "course.duplicate": "Course duplicated",
  "course.publish": "Course published",
  "course.unpublish": "Course unpublished",
  "course.archive": "Course archived",
  "course.delete": "Course deleted",
  "assignment.create": "Training assigned",
  "assignment.update": "Assignment updated",
  "assignment.delete": "Assignment removed",
  "assignment.nudge": "Reminder sent",
  "team.create": "Team created",
  "team.update": "Team updated",
  "team.delete": "Team deleted",
  "team.members": "Team members changed",
  "team.lead": "Team lead changed",
  "reminders.run": "Reminders run",
};

/** Record an admin-relevant change. Never throws: auditing must not break the action. */
export async function audit(actor: Pick<User, "id" | "name"> | null, entry: AuditInput, tx?: Tx) {
  try {
    const db = tx ?? (await getDb());
    await db.insert(auditLog).values({ actorId: actor?.id ?? null, actorName: actor?.name ?? "System", ...entry });
  } catch (e) {
    console.error("audit failed", entry.action, e);
  }
}
