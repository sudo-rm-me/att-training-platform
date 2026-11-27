import "server-only";
import { and, avg, count, desc, eq, inArray, isNotNull } from "drizzle-orm";
import { getDb } from "@/db";
import { attempts, courseRatings, users } from "@/db/schema";

export type RatingSummary = { avg: number; count: number };

export async function ratingSummary(courseIds: string[]) {
  const out = new Map<string, RatingSummary>();
  if (courseIds.length === 0) return out;
  const db = await getDb();
  const rows = await db
    .select({ courseId: courseRatings.courseId, avg: avg(courseRatings.stars), n: count() })
    .from(courseRatings)
    .where(inArray(courseRatings.courseId, courseIds))
    .groupBy(courseRatings.courseId);
  for (const r of rows) out.set(r.courseId, { avg: Math.round(Number(r.avg ?? 0) * 10) / 10, count: r.n });
  return out;
}

export async function myRating(userId: string, courseId: string) {
  const db = await getDb();
  const [r] = await db
    .select()
    .from(courseRatings)
    .where(and(eq(courseRatings.userId, userId), eq(courseRatings.courseId, courseId)));
  return r ?? null;
}

/** Only people who finished the course at least once can rate it. */
export async function rateCourse(userId: string, courseId: string, stars: number, comment: string | null) {
  const db = await getDb();
  const [done] = await db
    .select({ id: attempts.id })
    .from(attempts)
    .where(and(eq(attempts.userId, userId), eq(attempts.courseId, courseId), isNotNull(attempts.completedAt)))
    .limit(1);
  if (!done) return false;
  const values = { stars: Math.max(1, Math.min(5, Math.round(stars))), comment: comment?.trim().slice(0, 1000) || null, updatedAt: new Date() };
  await db
    .insert(courseRatings)
    .values({ userId, courseId, ...values })
    .onConflictDoUpdate({ target: [courseRatings.userId, courseRatings.courseId], set: values });
  return true;
}

/** Feedback for authors (most recent first). */
export async function courseFeedback(courseId: string, limit = 50) {
  const db = await getDb();
  return db
    .select({ stars: courseRatings.stars, comment: courseRatings.comment, at: courseRatings.updatedAt, name: users.name })
    .from(courseRatings)
    .innerJoin(users, eq(users.id, courseRatings.userId))
    .where(eq(courseRatings.courseId, courseId))
    .orderBy(desc(courseRatings.updatedAt))
    .limit(limit);
}
