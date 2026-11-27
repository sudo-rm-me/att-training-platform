import "server-only";
import { and, count, countDistinct, eq, isNotNull, lt, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { attempts, courses, userBadges, userItems, users, type Attempt } from "@/db/schema";
import { BADGES, type BadgeDef, type BadgeStats } from "./badges";
import { levelFromXp } from "./levels";
import { grantXp } from "./rewards";

export const TZ = () => process.env.APP_TIMEZONE || "Europe/London";

/** YYYY-MM-DD in the app's timezone. */
export function dayKey(d: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ(), year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

export function hourIn(d: Date) {
  return Number(new Intl.DateTimeFormat("en-GB", { timeZone: TZ(), hour: "numeric", hourCycle: "h23" }).format(d));
}

function prevDay(day: string) {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/** The streak as it stands today (a streak is broken if yesterday was missed). */
export function liveStreak(u: { currentStreak: number; lastActiveDay: string | null }) {
  if (!u.lastActiveDay) return 0;
  const today = dayKey(new Date());
  return u.lastActiveDay === today || u.lastActiveDay === prevDay(today) ? u.currentStreak : 0;
}

export async function badgeStats(userId: string, last?: BadgeStats["last"]): Promise<BadgeStats> {
  const db = await getDb();
  const [u] = await db.select().from(users).where(eq(users.id, userId));
  const [passed] = await db
    .select({ n: countDistinct(attempts.courseId) })
    .from(attempts)
    .where(and(eq(attempts.userId, userId), eq(attempts.passed, true)));
  const [perfect] = await db
    .select({ n: countDistinct(attempts.courseId) })
    .from(attempts)
    .where(and(eq(attempts.userId, userId), eq(attempts.score, 100), isNotNull(attempts.completedAt)));
  const [items] = await db
    .select({ n: count() })
    .from(userItems)
    .where(and(eq(userItems.userId, userId), sql`${userItems.price} > 0`));
  return {
    passedCourses: passed.n,
    perfectCourses: perfect.n,
    currentStreak: liveStreak(u),
    longestStreak: u.longestStreak,
    level: levelFromXp(u.xp).level,
    itemsBought: items.n,
    avatarCustomised: u.avatar != null,
    last,
  };
}

/** Award any newly-earned badges (each grants bonus XP). Loops so level badges can chain. */
export async function awardBadges(userId: string, last?: BadgeStats["last"], refId?: string): Promise<BadgeDef[]> {
  const db = await getDb();
  const earned: BadgeDef[] = [];
  for (let round = 0; round < 3; round++) {
    const have = new Set(
      (await db.select({ b: userBadges.badge }).from(userBadges).where(eq(userBadges.userId, userId))).map((r) => r.b),
    );
    const stats = await badgeStats(userId, last);
    const fresh = BADGES.filter((b) => !have.has(b.key) && b.earned(stats));
    if (fresh.length === 0) break;
    for (const b of fresh) {
      const inserted = await db.transaction(async (tx) => {
        const rows = await tx
          .insert(userBadges)
          .values({ userId, badge: b.key, refId })
          .onConflictDoNothing()
          .returning();
        if (rows.length) await grantXp(tx, userId, b.xp, Math.round(b.xp / 2), "badge", refId ?? b.key);
        return rows.length > 0;
      });
      if (inserted) earned.push(b);
    }
  }
  return earned;
}

/** Update the learning streak for activity happening now. Returns bonus XP granted. */
export async function touchStreak(userId: string, refId: string) {
  const db = await getDb();
  const today = dayKey(new Date());
  return db.transaction(async (tx) => {
    const [u] = await tx.select().from(users).where(eq(users.id, userId)).for("update");
    if (u.lastActiveDay === today) return { streak: u.currentStreak, bonus: 0 };
    const streak = u.lastActiveDay === prevDay(today) ? u.currentStreak + 1 : 1;
    await tx
      .update(users)
      .set({ currentStreak: streak, longestStreak: Math.max(u.longestStreak, streak), lastActiveDay: today })
      .where(eq(users.id, userId));
    const bonus = streak >= 2 ? 5 * Math.min(streak, 10) : 0;
    if (bonus) await grantXp(tx, userId, bonus, Math.round(bonus / 2), "streak", refId);
    return { streak, bonus };
  });
}

/** Everything that happens after an attempt is completed for the first time. */
export async function afterCompletion(attempt: Attempt) {
  if (!attempt.completedAt) return;
  const db = await getDb();
  const [course] = await db.select().from(courses).where(eq(courses.id, attempt.courseId));
  const [prevFail] = await db
    .select({ n: count() })
    .from(attempts)
    .where(
      and(
        eq(attempts.userId, attempt.userId),
        eq(attempts.courseId, attempt.courseId),
        eq(attempts.passed, false),
        lt(attempts.completedAt, attempt.completedAt),
      ),
    );
  await touchStreak(attempt.userId, attempt.id);
  await awardBadges(
    attempt.userId,
    {
      passed: Boolean(attempt.passed),
      score: attempt.score ?? 0,
      hour: hourIn(attempt.completedAt),
      durationSec: (attempt.completedAt.getTime() - attempt.startedAt.getTime()) / 1000,
      estimatedMinutes: course?.estimatedMinutes ?? 10,
      previouslyFailed: prevFail.n > 0,
    },
    attempt.id,
  );
}
