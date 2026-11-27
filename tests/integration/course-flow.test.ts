import { beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { userBadges, xpEvents, type Course } from "@/db/schema";
import { installSampleCourse } from "@/lib/sample-course";
import { answerQuestion, AttemptError, completeAttempt, getPlayerData, startOrResumeAttempt } from "@/lib/attempts";
import { afterCompletion } from "@/lib/gamification";
import { questionPoints } from "@/lib/quiz";
import { coinsForXp, PERFECT_BONUS_XP } from "@/lib/rewards";
import { certificatesFor } from "@/lib/certificates";
import { correctAnswer, wrongAnswer } from "../support/answers";
import { makeUser, questionSlides, reloadUser } from "../support/db";

let course: Course;
let totalPoints = 0;

beforeAll(async () => {
  const author = await makeUser({ role: "author" });
  course = await installSampleCourse(author.id);
  totalPoints = (await questionSlides(course.id)).reduce((n, s) => n + questionPoints(s.question!), 0);
});

async function play(userId: string, mode: "perfect" | "fail" | "partial") {
  const attempt = await startOrResumeAttempt(userId, course.id);
  const qs = await questionSlides(course.id);
  for (const [i, s] of qs.entries()) {
    const right = mode === "perfect" || (mode === "partial" && i < qs.length - 1);
    await answerQuestion(attempt.id, userId, s.id, right ? correctAnswer(s.question!) : wrongAnswer(s.question!));
  }
  return completeAttempt(attempt.id, userId);
}

describe("taking a course", () => {
  it("resumes the open attempt instead of starting a new one", async () => {
    const u = await makeUser();
    const a1 = await startOrResumeAttempt(u.id, course.id);
    const a2 = await startOrResumeAttempt(u.id, course.id);
    expect(a2.id).toBe(a1.id);
    const a3 = await startOrResumeAttempt(u.id, course.id, { restart: true });
    expect(a3.id).not.toBe(a1.id);
  });

  it("only lets the owner see or answer an attempt", async () => {
    const owner = await makeUser();
    const other = await makeUser();
    const a = await startOrResumeAttempt(owner.id, course.id);
    await expect(getPlayerData(a.id, other.id)).rejects.toThrow();
    const [q] = await questionSlides(course.id);
    await expect(answerQuestion(a.id, other.id, q.id, correctAnswer(q.question!))).rejects.toThrow();
  });

  it("does not send answers to the player", async () => {
    const u = await makeUser();
    const a = await startOrResumeAttempt(u.id, course.id);
    const data = await getPlayerData(a.id, u.id);
    expect(JSON.stringify(data.slides)).not.toContain('"correct"');
  });

  it("locks the first answer to each question", async () => {
    const u = await makeUser();
    const a = await startOrResumeAttempt(u.id, course.id);
    const [q] = await questionSlides(course.id);
    const first = await answerQuestion(a.id, u.id, q.id, wrongAnswer(q.question!));
    const second = await answerQuestion(a.id, u.id, q.id, correctAnswer(q.question!));
    expect(first.correct).toBe(false);
    expect(second.correct).toBe(false);
  });

  it("awards points, completion XP and the perfect bonus for a perfect pass", async () => {
    const u = await makeUser();
    const r = await play(u.id, "perfect");
    expect(r.attempt).toMatchObject({ score: 100, passed: true });
    expect(r.firstPass).toBe(true);
    expect(r.xpAwarded).toBe(totalPoints + course.completionXp + PERFECT_BONUS_XP);
    expect(r.coinsAwarded).toBe(coinsForXp(r.xpAwarded));
    const fresh = await reloadUser(u.id);
    expect(fresh.xp).toBe(r.xpAwarded);
  });

  it("gives no extra XP for retaking with the same result", async () => {
    const u = await makeUser();
    await play(u.id, "perfect");
    const again = await play(u.id, "perfect");
    expect(again.xpAwarded).toBe(0);
    expect(again.firstPass).toBe(false);
  });

  it("only awards the improvement when a retake does better", async () => {
    const u = await makeUser();
    const first = await play(u.id, "partial");
    const second = await play(u.id, "perfect");
    const total = totalPoints + course.completionXp + PERFECT_BONUS_XP;
    expect(first.xpAwarded + second.xpAwarded).toBe(total);
  });

  it("records a fail without completion XP or a certificate", async () => {
    const u = await makeUser();
    const r = await play(u.id, "fail");
    expect(r.attempt.passed).toBe(false);
    expect(r.attempt.score).toBe(0);
    expect(await certificatesFor(u.id)).toHaveLength(0);
  });

  it("completes exactly once", async () => {
    const u = await makeUser();
    const a = await startOrResumeAttempt(u.id, course.id);
    const [r1, r2] = await Promise.all([completeAttempt(a.id, u.id), completeAttempt(a.id, u.id)]);
    expect([r1.newlyCompleted, r2.newlyCompleted].filter(Boolean)).toHaveLength(1);
    const db = await getDb();
    const events = await db.select().from(xpEvents).where(and(eq(xpEvents.userId, u.id), eq(xpEvents.refId, a.id)));
    expect(events.length).toBeLessThanOrEqual(1);
  });

  it("enforces the attempt limit", async () => {
    const db = await getDb();
    const { courses } = await import("@/db/schema");
    await db.update(courses).set({ maxAttempts: 1 }).where(eq(courses.id, course.id));
    try {
      const u = await makeUser();
      await play(u.id, "fail");
      await expect(startOrResumeAttempt(u.id, course.id)).rejects.toBeInstanceOf(AttemptError);
    } finally {
      await db.update(courses).set({ maxAttempts: null }).where(eq(courses.id, course.id));
    }
  });
});

describe("after completion", () => {
  it("starts a streak, awards First Steps and issues a certificate", async () => {
    const u = await makeUser();
    const r = await play(u.id, "perfect");
    await afterCompletion(r.attempt);
    const fresh = await reloadUser(u.id);
    expect(fresh.currentStreak).toBe(1);
    const db = await getDb();
    const badges = (await db.select().from(userBadges).where(eq(userBadges.userId, u.id))).map((b) => b.badge);
    expect(badges).toContain("first_steps");
    expect(badges).toContain("perfectionist");
    const certs = await certificatesFor(u.id);
    expect(certs).toHaveLength(1);
    expect(certs[0]).toMatchObject({ courseId: course.id, bestScore: 100, attemptId: r.attempt.id });
  });

  it("doesn't award the same badge twice", async () => {
    const u = await makeUser();
    const r1 = await play(u.id, "perfect");
    await afterCompletion(r1.attempt);
    const r2 = await play(u.id, "perfect");
    await afterCompletion(r2.attempt);
    const db = await getDb();
    const rows = await db
      .select()
      .from(userBadges)
      .where(and(eq(userBadges.userId, u.id), eq(userBadges.badge, "first_steps")));
    expect(rows).toHaveLength(1);
  });
});
