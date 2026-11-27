import "server-only";
import { and, avg, count, countDistinct, eq, gte, isNotNull, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { attemptAnswers, attempts, courses, slides, teams } from "@/db/schema";
import { snapshot } from "./reminders";
import { ratingSummary } from "./ratings";

const DAY = 86_400_000;

/** Monday 00:00 UTC of the week containing d. */
function weekStart(d: Date) {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  x.setUTCDate(x.getUTCDate() - ((x.getUTCDay() + 6) % 7));
  return x;
}

export type WeekPoint = { week: string; label: string; passed: number; attempts: number };
export type GroupCompliance = { key: string; label: string; people: number; required: number; done: number; pct: number };
export type CourseRow = {
  id: string;
  title: string;
  icon: string;
  attempts: number;
  learners: number;
  passRate: number | null;
  avgScore: number | null;
  rating: number | null;
  ratings: number;
};
export type HardQuestion = { slideId: string; title: string; course: string; answers: number; correctPct: number };

export async function reportData(now = new Date(), weeks = 12) {
  const db = await getDb();
  const since30 = new Date(now.getTime() - 30 * DAY);
  const firstWeek = weekStart(new Date(now.getTime() - (weeks - 1) * 7 * DAY));

  const [[active], [recent], completedRows, courseStats, hard, snap, teamRows, published] = await Promise.all([
    db.select({ n: countDistinct(attempts.userId) }).from(attempts).where(gte(attempts.startedAt, since30)),
    db
      .select({ passed: sql<number>`count(*) filter (where ${attempts.passed})`.mapWith(Number), avgScore: avg(attempts.score), n: count() })
      .from(attempts)
      .where(and(isNotNull(attempts.completedAt), gte(attempts.completedAt, since30))),
    db
      .select({ at: attempts.completedAt, passed: attempts.passed })
      .from(attempts)
      .where(and(isNotNull(attempts.completedAt), gte(attempts.completedAt, firstWeek))),
    db
      .select({
        courseId: attempts.courseId,
        attempts: count(),
        learners: countDistinct(attempts.userId),
        passed: sql<number>`count(*) filter (where ${attempts.passed})`.mapWith(Number),
        avgScore: avg(attempts.score),
      })
      .from(attempts)
      .where(isNotNull(attempts.completedAt))
      .groupBy(attempts.courseId),
    db
      .select({
        slideId: attemptAnswers.slideId,
        n: count(),
        right: sql<number>`count(*) filter (where ${attemptAnswers.correct})`.mapWith(Number),
      })
      .from(attemptAnswers)
      .groupBy(attemptAnswers.slideId)
      .having(sql`count(*) >= 3`)
      .orderBy(sql`count(*) filter (where ${attemptAnswers.correct})::float / count(*)`)
      .limit(6),
    snapshot(now),
    db.select().from(teams),
    db.select({ id: courses.id, title: courses.title, icon: courses.icon }).from(courses).where(eq(courses.status, "published")),
  ]);

  // Completions per week.
  const buckets = new Map<string, WeekPoint>();
  const fmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
  for (let i = 0; i < weeks; i++) {
    const w = new Date(firstWeek.getTime() + i * 7 * DAY);
    const key = w.toISOString().slice(0, 10);
    buckets.set(key, { week: key, label: fmt.format(w), passed: 0, attempts: 0 });
  }
  for (const r of completedRows) {
    const b = buckets.get(weekStart(r.at!).toISOString().slice(0, 10));
    if (!b) continue;
    b.attempts++;
    if (r.passed) b.passed++;
  }

  // Compliance by team (or department when no teams are set up).
  const useTeams = teamRows.length > 0;
  const teamLabel = new Map(teamRows.map((t) => [t.id, `${t.icon} ${t.name}`]));
  const groups = new Map<string, GroupCompliance>();
  let required = 0;
  let done = 0;
  for (const p of snap.people) {
    const row = snap.byUser.get(p.id);
    if (!row || row.total === 0) continue;
    required += row.total;
    done += row.done;
    const key = (useTeams ? p.teamId : p.department?.trim()) || "";
    const label = key ? (useTeams ? (teamLabel.get(key) ?? "Unknown team") : key) : useTeams ? "No team" : "No department";
    const g = groups.get(key) ?? { key, label, people: 0, required: 0, done: 0, pct: 0 };
    g.people++;
    g.required += row.total;
    g.done += row.done;
    groups.set(key, g);
  }
  const compliance = [...groups.values()]
    .map((g) => ({ ...g, pct: Math.round((g.done / g.required) * 100) }))
    .sort((a, b) => a.pct - b.pct || b.people - a.people);

  // Course table.
  const stats = new Map(courseStats.map((s) => [s.courseId, s]));
  const ratings = await ratingSummary(published.map((c) => c.id));
  const courseRows: CourseRow[] = published
    .map((c) => {
      const s = stats.get(c.id);
      const r = ratings.get(c.id);
      return {
        id: c.id,
        title: c.title,
        icon: c.icon,
        attempts: s?.attempts ?? 0,
        learners: s?.learners ?? 0,
        passRate: s && s.attempts ? Math.round((s.passed / s.attempts) * 100) : null,
        avgScore: s?.avgScore != null ? Math.round(Number(s.avgScore)) : null,
        rating: r?.avg ?? null,
        ratings: r?.count ?? 0,
      };
    })
    .sort((a, b) => b.learners - a.learners || a.title.localeCompare(b.title));

  // Hardest questions (titles from the current draft where the slide still exists).
  const ids = hard.map((h) => h.slideId);
  const titles = ids.length
    ? await db
        .select({ id: slides.id, title: slides.title, course: courses.title })
        .from(slides)
        .innerJoin(courses, eq(courses.id, slides.courseId))
        .where(sql`${slides.id} in ${ids}`)
    : [];
  const titleBy = new Map(titles.map((t) => [t.id, t]));
  const hardest: HardQuestion[] = hard.map((h) => ({
    slideId: h.slideId,
    title: titleBy.get(h.slideId)?.title || "Question (removed from draft)",
    course: titleBy.get(h.slideId)?.course ?? "",
    answers: h.n,
    correctPct: Math.round((h.right / h.n) * 100),
  }));

  return {
    tiles: {
      people: snap.people.length,
      activeLearners: active.n,
      completions30: recent.passed,
      attempts30: recent.n,
      avgScore30: recent.avgScore != null ? Math.round(Number(recent.avgScore)) : null,
      compliancePct: required ? Math.round((done / required) * 100) : null,
      required,
    },
    weekly: [...buckets.values()],
    compliance,
    groupBy: useTeams ? ("team" as const) : ("department" as const),
    courses: courseRows,
    hardest,
  };
}
