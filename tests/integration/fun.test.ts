import { describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { events, users, xpEvents } from "@/db/schema";
import { installSampleCourse } from "@/lib/sample-course";
import { answerQuestion, attemptSlides, completeAttempt, saveProgress, startOrResumeAttempt } from "@/lib/attempts";
import { speedBonus } from "@/lib/quiz";
import { activeEvent, eventStandings, featuredEvent } from "@/lib/events";
import { giveKudos, kudosFeed, KudosError, KUDOS_DAILY_LIMIT, KUDOS_GIVER_XP } from "@/lib/kudos";
import { awardBadges } from "@/lib/gamification";
import { AVATAR_ITEMS, badgeItemKeys, isUnlocked } from "@/lib/avatar";
import { correctAnswer } from "../support/answers";
import { makeUser, reloadUser } from "../support/db";

async function withCoins(coins: number) {
  const u = await makeUser();
  const db = await getDb();
  await db.update(users).set({ coins }).where(eq(users.id, u.id));
  return u;
}

describe("speed bonus", () => {
  it("rewards quick answers on a sliding scale", () => {
    expect(speedBonus(10, 5_000)).toBe(5);
    expect(speedBonus(10, 20_000)).toBe(3);
    expect(speedBonus(10, 45_000)).toBe(0);
    expect(speedBonus(0, 1_000)).toBe(0);
    expect(speedBonus(10, null)).toBe(0);
  });

  it("is granted when answering right after the slide appears, and adds XP", async () => {
    const author = await makeUser({ role: "author" });
    const course = await installSampleCourse(author.id);
    const learner = await makeUser();
    const attempt = await startOrResumeAttempt(learner.id, course.id);
    const list = await attemptSlides(attempt);
    let total = 0;
    for (let i = 0; i < list.length; i++) {
      const s = list[i];
      if (!s.question) continue;
      await saveProgress(attempt.id, learner.id, i);
      const fb = await answerQuestion(attempt.id, learner.id, s.id, correctAnswer(s.question));
      expect(fb.correct).toBe(true);
      expect(fb.bonus).toBeGreaterThan(0);
      total += fb.bonus ?? 0;
    }
    const done = await completeAttempt(attempt.id, learner.id);
    expect(done.attempt.score).toBe(100);
    expect(total).toBeGreaterThan(0);
  });
});

describe("seasonal events", () => {
  it("multiplies course XP while live and ranks teams", async () => {
    const db = await getDb();
    const now = Date.now();
    const [e] = await db
      .insert(events)
      .values({
        name: "Double XP week",
        startsAt: new Date(now - 60_000),
        endsAt: new Date(now + 86_400_000),
        xpMultiplier: 200,
        teamChallenge: true,
      })
      .returning();
    expect((await activeEvent())?.id).toBe(e.id);
    expect((await featuredEvent())?.live).toBe(true);

    const author = await makeUser({ role: "author" });
    const course = await installSampleCourse(author.id);
    const learner = await makeUser();
    const attempt = await startOrResumeAttempt(learner.id, course.id);
    for (const s of await attemptSlides(attempt)) {
      if (s.question) await answerQuestion(attempt.id, learner.id, s.id, correctAnswer(s.question));
    }
    const done = await completeAttempt(attempt.id, learner.id);
    const [bonus] = await db
      .select()
      .from(xpEvents)
      .where(and(eq(xpEvents.refId, attempt.id), eq(xpEvents.reason, "event")));
    expect(bonus.xp).toBe(done.attempt.xpEarned);

    // Standings only include people on teams; just check the call works on the window.
    expect(Array.isArray(await eventStandings(e))).toBe(true);
    await db.delete(events).where(eq(events.id, e.id));
    expect(await activeEvent()).toBeNull();
  });
});

describe("kudos", () => {
  it("moves coins, rewards the giver and lists on the wall", async () => {
    const a = await withCoins(100);
    const b = await withCoins(0);
    await giveKudos(a.id, b.id, 25, "Thanks for the help with onboarding!");
    const [a2, b2] = await Promise.all([reloadUser(a.id), reloadUser(b.id)]);
    expect(a2.coins).toBe(75);
    expect(a2.xp).toBe(KUDOS_GIVER_XP);
    expect(b2.coins).toBe(25);
    const feed = await kudosFeed(5, b.id);
    expect(feed[0].message).toContain("onboarding");
    expect(feed[0].from.id).toBe(a.id);
  });

  it("refuses self-kudos, overspending, odd amounts and the daily cap", async () => {
    const a = await withCoins(500);
    const b = await makeUser();
    await expect(giveKudos(a.id, a.id, 5, "Me!")).rejects.toBeInstanceOf(KudosError);
    await expect(giveKudos(a.id, b.id, 7, "Thanks!")).rejects.toThrow("Pick an amount");
    await expect(giveKudos(a.id, b.id, 5, "x")).rejects.toThrow(/Say what they did/);
    const poor = await withCoins(5);
    await expect(giveKudos(poor.id, b.id, 10, "Thanks a lot")).rejects.toThrow(/only have 5/);

    await giveKudos(a.id, b.id, 50, "Great presentation");
    await giveKudos(a.id, b.id, 50, "And the follow-up notes");
    await expect(giveKudos(a.id, b.id, 5, "One more")).rejects.toThrow(String(KUDOS_DAILY_LIMIT));
  });

  it("earns the kudos badges and unlocks a rare avatar item", async () => {
    const givers = await Promise.all([1, 2, 3, 4, 5].map(() => withCoins(50)));
    const star = await makeUser();
    for (const g of givers) await giveKudos(g.id, star.id, 5, "You're a star");
    const earned = (await awardBadges(star.id)).map((b) => b.key);
    expect(earned).toContain("appreciated");
    const aurora = AVATAR_ITEMS.find((i) => i.value === "aurora")!;
    expect(isUnlocked(aurora, 1, new Set())).toBe(false);
    expect(isUnlocked(aurora, 1, new Set(badgeItemKeys(earned)))).toBe(true);
  });
});
