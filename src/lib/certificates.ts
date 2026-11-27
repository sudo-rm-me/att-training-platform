import "server-only";
import { and, asc, eq, isNotNull } from "drizzle-orm";
import { getDb } from "@/db";
import { attempts, courses } from "@/db/schema";

export type Certificate = {
  /** The first passing attempt: its id doubles as the certificate number. */
  attemptId: string;
  courseId: string;
  courseTitle: string;
  courseIcon: string;
  category: string;
  theme: string;
  issuedAt: Date;
  bestScore: number;
};

export function certificateNumber(attemptId: string) {
  return attemptId.replace(/-/g, "").slice(0, 12).toUpperCase().replace(/(.{4})(?=.)/g, "$1-");
}

/** One certificate per course the user has passed. */
export async function certificatesFor(userId: string, courseId?: string): Promise<Certificate[]> {
  const db = await getDb();
  const rows = await db
    .select({
      attemptId: attempts.id,
      courseId: courses.id,
      courseTitle: courses.title,
      courseIcon: courses.icon,
      category: courses.category,
      theme: courses.theme,
      completedAt: attempts.completedAt,
      score: attempts.score,
    })
    .from(attempts)
    .innerJoin(courses, eq(courses.id, attempts.courseId))
    .where(
      and(
        eq(attempts.userId, userId),
        eq(attempts.passed, true),
        isNotNull(attempts.completedAt),
        courseId ? eq(attempts.courseId, courseId) : undefined,
      ),
    )
    .orderBy(asc(attempts.completedAt));

  const byCourse = new Map<string, Certificate>();
  for (const r of rows) {
    const existing = byCourse.get(r.courseId);
    if (!existing) {
      byCourse.set(r.courseId, {
        attemptId: r.attemptId,
        courseId: r.courseId,
        courseTitle: r.courseTitle,
        courseIcon: r.courseIcon,
        category: r.category,
        theme: r.theme,
        issuedAt: r.completedAt!,
        bestScore: r.score ?? 0,
      });
    } else if ((r.score ?? 0) > existing.bestScore) {
      existing.bestScore = r.score ?? 0;
    }
  }
  return [...byCourse.values()].sort((a, b) => b.issuedAt.getTime() - a.issuedAt.getTime());
}
