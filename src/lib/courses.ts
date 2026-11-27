import "server-only";
import { cache } from "react";
import { and, count, desc, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { attempts, courses, slides, type Course } from "@/db/schema";
import { ratingSummary, type RatingSummary } from "./ratings";

export type CourseProgress = {
  status: "not_started" | "in_progress" | "completed" | "failed";
  bestScore: number | null;
  attemptsUsed: number;
  openAttemptId: string | null;
  lastActivity: Date | null;
};

export type CatalogCourse = Course & {
  slideCount: number;
  questionCount: number;
  progress: CourseProgress;
  rating: RatingSummary | null;
};

export async function slideCounts(courseIds: string[]) {
  if (courseIds.length === 0) return new Map<string, { slides: number; questions: number }>();
  const db = await getDb();
  const rows = await db
    .select({
      courseId: slides.courseId,
      slides: count(),
      questions: sql<number>`count(*) filter (where ${slides.kind} = 'question')`.mapWith(Number),
    })
    .from(slides)
    .where(inArray(slides.courseId, courseIds))
    .groupBy(slides.courseId);
  return new Map(rows.map((r) => [r.courseId, { slides: r.slides, questions: r.questions }]));
}

export async function progressFor(userId: string, courseIds: string[]) {
  const out = new Map<string, CourseProgress>();
  for (const id of courseIds)
    out.set(id, { status: "not_started", bestScore: null, attemptsUsed: 0, openAttemptId: null, lastActivity: null });
  if (courseIds.length === 0) return out;
  const db = await getDb();
  const rows = await db
    .select()
    .from(attempts)
    .where(and(eq(attempts.userId, userId), inArray(attempts.courseId, courseIds)))
    .orderBy(desc(attempts.startedAt));

  for (const a of rows) {
    const p = out.get(a.courseId)!;
    const when = a.completedAt ?? a.startedAt;
    if (!p.lastActivity || when > p.lastActivity) p.lastActivity = when;
    if (!a.completedAt) {
      p.openAttemptId ??= a.id;
      continue;
    }
    p.attemptsUsed++;
    if (a.score != null && (p.bestScore == null || a.score > p.bestScore)) p.bestScore = a.score;
    if (a.passed) p.status = "completed";
    else if (p.status !== "completed") p.status = "failed";
  }
  for (const p of out.values()) if (p.openAttemptId && p.status !== "completed") p.status = "in_progress";
  return out;
}

export const listCatalog = cache(async (userId: string): Promise<CatalogCourse[]> => {
  const db = await getDb();
  const list = await db
    .select()
    .from(courses)
    .where(eq(courses.status, "published"))
    .orderBy(desc(courses.publishedAt));
  const ids = list.map((c) => c.id);
  const [counts, progress, ratings] = await Promise.all([slideCounts(ids), progressFor(userId, ids), ratingSummary(ids)]);
  return list.map((c) => {
    const questions = counts.get(c.id)?.questions ?? 0;
    return {
      ...c,
      slideCount: counts.get(c.id)?.slides ?? 0,
      questionCount: c.drawQuestions ? Math.min(c.drawQuestions, questions) : questions,
      progress: progress.get(c.id)!,
      rating: ratings.get(c.id) ?? null,
    };
  });
});
