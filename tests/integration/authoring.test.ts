import { beforeAll, describe, expect, it } from "vitest";
import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { courses, slides, type Course } from "@/db/schema";
import { installSampleCourse } from "@/lib/sample-course";
import { answerQuestion, attemptSlides, completeAttempt, drawQuestionIds, getPlayerData, startOrResumeAttempt } from "@/lib/attempts";
import { hasUnpublishedChanges, latestVersion, listVersions, publishVersion, restoreVersion } from "@/lib/versions";
import { courseFeedback, myRating, rateCourse, ratingSummary } from "@/lib/ratings";
import { correctAnswer } from "../support/answers";
import { makeUser } from "../support/db";

let author: Awaited<ReturnType<typeof makeUser>>;

beforeAll(async () => {
  author = await makeUser({ role: "author" });
});

const fresh = async (): Promise<Course> => installSampleCourse(author.id);
const draft = async (courseId: string) => (await getDb()).select().from(slides).where(eq(slides.courseId, courseId)).orderBy(asc(slides.position));

describe("course versions", () => {
  it("keeps learners on the version they started while authors edit and republish", async () => {
    const db = await getDb();
    const course = await fresh();
    const learner = await makeUser();
    const a1 = await startOrResumeAttempt(learner.id, course.id);
    const v1 = await latestVersion(course.id);
    expect(a1.versionId).toBe(v1!.id);
    const before = (await getPlayerData(a1.id, learner.id)).slides.map((s) => s.title);

    // Author edits the draft: a new title and one slide fewer.
    const [first, ...rest] = await draft(course.id);
    await db.update(slides).set({ title: "Brand new title" }).where(eq(slides.id, first.id));
    await db.delete(slides).where(eq(slides.id, rest[rest.length - 1].id));
    expect(await hasUnpublishedChanges(course.id)).toBe(true);

    // Unpublished edits don't reach learners.
    expect((await getPlayerData(a1.id, learner.id)).slides.map((s) => s.title)).toEqual(before);

    const v2 = await publishVersion(course.id, author.id, "Retitled");
    expect(v2.version).toBe(v1!.version + 1);
    expect(await hasUnpublishedChanges(course.id)).toBe(false);

    // The open attempt still uses v1 (including the slide deleted from the draft) and can be finished.
    const qs = (await attemptSlides(a1)).filter((s) => s.question);
    for (const q of qs) await answerQuestion(a1.id, learner.id, q.id, correctAnswer(q.question!));
    expect((await completeAttempt(a1.id, learner.id)).attempt.score).toBe(100);

    // New attempts take v2.
    const other = await makeUser();
    const a2 = await startOrResumeAttempt(other.id, course.id);
    expect(a2.versionId).toBe(v2.id);
    expect((await getPlayerData(a2.id, other.id)).slides[0].title).toBe("Brand new title");

    expect((await listVersions(course.id)).map((v) => v.version)).toEqual([v2.version, v1!.version]);
  });

  it("restores an old version into the draft without touching the live one", async () => {
    const course = await fresh();
    const v1 = await publishVersion(course.id, author.id);
    const db = await getDb();
    await db.delete(slides).where(eq(slides.courseId, course.id));
    await publishVersion(course.id, author.id, "Emptied");
    await restoreVersion(course.id, v1.id);
    expect((await draft(course.id)).map((s) => s.id)).toEqual(v1.slides.map((s) => s.id));
    expect((await latestVersion(course.id))!.slides).toHaveLength(0);
    expect(await hasUnpublishedChanges(course.id)).toBe(true);
  });
});

describe("question banks", () => {
  it("draws a random subset per attempt and scores against it", async () => {
    const db = await getDb();
    const course = await fresh();
    await db.update(courses).set({ drawQuestions: 2 }).where(eq(courses.id, course.id));
    const learner = await makeUser();
    const a = await startOrResumeAttempt(learner.id, course.id);
    expect(a.questionIds).toHaveLength(2);
    const qs = (await attemptSlides(a)).filter((s) => s.question && s.question.type !== "acknowledge");
    expect(qs).toHaveLength(2);
    expect((await getPlayerData(a.id, learner.id)).slides.filter((s) => s.question && s.question.type !== "acknowledge")).toHaveLength(2);
    for (const q of qs) await answerQuestion(a.id, learner.id, q.id, correctAnswer(q.question!));
    const done = await completeAttempt(a.id, learner.id);
    expect(done.attempt.score).toBe(100);
    expect(done.attempt.questionCount).toBeLessThanOrEqual(3);
  });

  it("uses every question when the pool is smaller than the draw", () => {
    const s = (id: string) => ({ id, kind: "question" as const, question: { type: "truefalse" as const, prompt: "", correct: true } }) as never;
    expect(drawQuestionIds([s("a"), s("b")], 5)).toBeNull();
    expect(drawQuestionIds([s("a"), s("b")], null)).toBeNull();
    expect(drawQuestionIds([s("a"), s("b"), s("c")], 2, () => 0)).toHaveLength(2);
  });
});

describe("ratings", () => {
  it("lets people who finished a course rate it once (editable)", async () => {
    const course = await fresh();
    const u = await makeUser();
    expect(await rateCourse(u.id, course.id, 5, "")).toBe(false); // hasn't taken it

    const a = await startOrResumeAttempt(u.id, course.id);
    await completeAttempt(a.id, u.id);
    expect(await rateCourse(u.id, course.id, 4, "Nice")).toBe(true);
    expect(await rateCourse(u.id, course.id, 2, "Changed my mind")).toBe(true);
    expect((await myRating(u.id, course.id))?.stars).toBe(2);
    expect((await ratingSummary([course.id])).get(course.id)).toEqual({ avg: 2, count: 1 });
    expect((await courseFeedback(course.id))[0].comment).toBe("Changed my mind");
  });
});
