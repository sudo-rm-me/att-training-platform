import "server-only";
import { and, asc, desc, eq, isNull, isNotNull, count, sum } from "drizzle-orm";
import { getDb } from "@/db";
import {
  attemptAnswers,
  attempts,
  courseVersions,
  courses,
  slides,
  type AnswerValue,
  type VersionSlide,
  type Attempt,
  type Course,
} from "@/db/schema";
import { describeCorrect, grade, questionPoints, speedBonus, toClientQuestion, type ClientQuestion } from "./quiz";

export { speedBonus };
import { coinsForXp, grantXp, PERFECT_BONUS_XP } from "./rewards";
import { ensureVersion, toVersionSlide } from "./versions";
import { grantEventBonus } from "./events";


/** Questions that count towards the score (acknowledgements always appear but aren't drawn). */
const scored = (s: VersionSlide) => s.kind === "question" && !!s.question && s.question.type !== "acknowledge";

/** Pick `n` random question slides for a question-bank attempt. */
export function drawQuestionIds(list: VersionSlide[], n: number | null, rand: () => number = Math.random): string[] | null {
  const pool = list.filter(scored).map((s) => s.id);
  if (!n || n >= pool.length) return null;
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, n);
}

/** The slides of an attempt: its frozen version, minus questions not drawn. */
export async function attemptSlides(attempt: Pick<Attempt, "courseId" | "versionId" | "questionIds">): Promise<VersionSlide[]> {
  const db = await getDb();
  let list: VersionSlide[];
  const [v] = attempt.versionId ? await db.select().from(courseVersions).where(eq(courseVersions.id, attempt.versionId)) : [];
  if (v) list = v.slides.map(toVersionSlide);
  else list = (await db.select().from(slides).where(eq(slides.courseId, attempt.courseId)).orderBy(asc(slides.position))).map(toVersionSlide);
  if (attempt.questionIds) {
    const keep = new Set(attempt.questionIds);
    list = list.filter((s) => !scored(s) || keep.has(s.id));
  }
  return list;
}

export class AttemptError extends Error {}

export async function completedAttemptCount(userId: string, courseId: string) {
  const db = await getDb();
  const [{ n }] = await db
    .select({ n: count() })
    .from(attempts)
    .where(and(eq(attempts.userId, userId), eq(attempts.courseId, courseId), isNotNull(attempts.completedAt)));
  return n;
}

/** Resume the open attempt for this course, or start a new one. */
export async function startOrResumeAttempt(userId: string, courseId: string, opts: { restart?: boolean } = {}) {
  const db = await getDb();
  const [course] = await db.select().from(courses).where(eq(courses.id, courseId)).limit(1);
  if (!course || course.status !== "published") throw new AttemptError("This course isn't available.");

  const [open] = await db
    .select()
    .from(attempts)
    .where(and(eq(attempts.userId, userId), eq(attempts.courseId, courseId), isNull(attempts.completedAt)))
    .orderBy(desc(attempts.startedAt))
    .limit(1);

  if (open && !opts.restart) return open;
  if (open && opts.restart) {
    await db.delete(attempts).where(eq(attempts.id, open.id));
  }

  if (course.maxAttempts != null) {
    const done = await completedAttemptCount(userId, courseId);
    if (done >= course.maxAttempts) throw new AttemptError("You've used all your attempts for this course.");
  }

  const version = await ensureVersion(courseId);
  const questionIds = drawQuestionIds(version.slides, course.drawQuestions);
  const [created] = await db.insert(attempts).values({ userId, courseId, versionId: version.id, questionIds }).returning();
  return created;
}

export type PlayerSlide = {
  id: string;
  kind: "content" | "question";
  layout: string;
  title: string;
  body: string;
  mediaUrl: string | null;
  requireMedia: boolean;
  question: ClientQuestion | null;
};

export type AnswerFeedback = {
  correct: boolean;
  points: number;
  explanation?: string;
  correctAnswer: string[];
  answer: AnswerValue;
  /** Speed bonus XP for a quick correct answer. */
  bonus?: number;
};

async function loadOwnedAttempt(attemptId: string, userId: string) {
  const db = await getDb();
  const [row] = await db
    .select({ attempt: attempts, course: courses })
    .from(attempts)
    .innerJoin(courses, eq(courses.id, attempts.courseId))
    .where(and(eq(attempts.id, attemptId), eq(attempts.userId, userId)))
    .limit(1);
  if (!row) throw new AttemptError("Attempt not found.");
  return row as { attempt: Attempt; course: Course };
}

export async function getPlayerData(attemptId: string, userId: string) {
  const db = await getDb();
  const { attempt, course } = await loadOwnedAttempt(attemptId, userId);
  const rows = await attemptSlides(attempt);
  const answers = await db.select().from(attemptAnswers).where(eq(attemptAnswers.attemptId, attempt.id));

  const feedback: Record<string, AnswerFeedback> = {};
  for (const a of answers) {
    const s = rows.find((r) => r.id === a.slideId);
    if (!s?.question) continue;
    feedback[a.slideId] = {
      correct: a.correct,
      points: a.points,
      bonus: a.bonus,
      explanation: s.question.explanation,
      correctAnswer: describeCorrect(s.question),
      answer: a.answer,
    };
  }

  const playerSlides: PlayerSlide[] = rows.map((s) => ({
    id: s.id,
    kind: s.kind,
    layout: s.layout,
    title: s.title,
    body: s.body,
    mediaUrl: s.mediaUrl,
    requireMedia: s.requireMedia,
    question: s.kind === "question" && s.question ? toClientQuestion(s.question, attempt.id + s.id) : null,
  }));

  return { attempt, course, slides: playerSlides, feedback };
}

export async function answerQuestion(attemptId: string, userId: string, slideId: string, answer: AnswerValue) {
  const db = await getDb();
  const { attempt } = await loadOwnedAttempt(attemptId, userId);
  if (attempt.completedAt) throw new AttemptError("This attempt is already finished.");

  const slide = (await attemptSlides(attempt)).find((s) => s.id === slideId);
  if (!slide?.question) throw new AttemptError("Question not found.");

  const [existing] = await db
    .select()
    .from(attemptAnswers)
    .where(and(eq(attemptAnswers.attemptId, attemptId), eq(attemptAnswers.slideId, slideId)))
    .limit(1);

  const q = slide.question;
  if (existing) {
    return {
      correct: existing.correct,
      points: existing.points,
      bonus: existing.bonus,
      explanation: q.explanation,
      correctAnswer: describeCorrect(q),
      answer: existing.answer,
    } satisfies AnswerFeedback;
  }

  const correct = grade(q, answer);
  const points = correct ? questionPoints(q) : 0;
  // The timer starts when the player moved onto this slide.
  const list = await attemptSlides(attempt);
  const onThisSlide = list[attempt.currentSlide]?.id === slideId && attempt.slideShownAt;
  const bonus = onThisSlide ? speedBonus(points, Date.now() - attempt.slideShownAt!.getTime()) : 0;
  await db.insert(attemptAnswers).values({ attemptId, slideId, answer, correct, points, bonus }).onConflictDoNothing();

  return { correct, points, bonus, explanation: q.explanation, correctAnswer: describeCorrect(q), answer } satisfies AnswerFeedback;
}

export async function saveProgress(attemptId: string, userId: string, slideIndex: number) {
  const db = await getDb();
  await db
    .update(attempts)
    .set({ currentSlide: Math.max(0, Math.floor(slideIndex)), slideShownAt: new Date() })
    .where(and(eq(attempts.id, attemptId), eq(attempts.userId, userId), isNull(attempts.completedAt)));
}

export type CompletionResult = {
  attempt: Attempt;
  xpAwarded: number;
  coinsAwarded: number;
  firstPass: boolean;
  newlyCompleted: boolean;
};

export async function completeAttempt(attemptId: string, userId: string): Promise<CompletionResult> {
  const db = await getDb();
  const { attempt, course } = await loadOwnedAttempt(attemptId, userId);
  if (attempt.completedAt)
    return { attempt, xpAwarded: attempt.xpEarned, coinsAwarded: attempt.coinsEarned, firstPass: false, newlyCompleted: false };

  const questions = (await attemptSlides(attempt)).filter((s) => s.kind === "question" && s.question);
  const ids = new Set(questions.map((q) => q.id));
  const answers = (await db.select().from(attemptAnswers).where(eq(attemptAnswers.attemptId, attemptId))).filter((a) => ids.has(a.slideId));
  const totalPoints = questions.reduce((n, s) => n + questionPoints(s.question!), 0);
  const earnedPoints = answers.reduce((n, a) => n + a.points, 0);
  const speedXp = answers.reduce((n, a) => n + a.bonus, 0);
  const correctCount = answers.filter((a) => a.correct).length;
  const score = totalPoints === 0 ? 100 : Math.round((earnedPoints / totalPoints) * 100);
  const passed = score >= course.passMark;

  return db.transaction(async (tx) => {
    // Lock in completion exactly once.
    const [done] = await tx
      .update(attempts)
      .set({
        completedAt: new Date(),
        score,
        correctCount,
        questionCount: questions.length,
        passed,
      })
      .where(and(eq(attempts.id, attemptId), isNull(attempts.completedAt)))
      .returning();
    if (!done) {
      const [a] = await tx.select().from(attempts).where(eq(attempts.id, attemptId));
      return { attempt: a, xpAwarded: a.xpEarned, coinsAwarded: a.coinsEarned, firstPass: false, newlyCompleted: false };
    }

    // XP already granted for this course (this attempt's xpEarned is still 0).
    const [prev] = await tx
      .select({ xp: sum(attempts.xpEarned) })
      .from(attempts)
      .where(and(eq(attempts.userId, userId), eq(attempts.courseId, course.id), isNotNull(attempts.completedAt)));
    // Includes this attempt when it passed.
    const [passes] = await tx
      .select({ n: count() })
      .from(attempts)
      .where(and(eq(attempts.userId, userId), eq(attempts.courseId, course.id), eq(attempts.passed, true)));
    const firstPass = passed && passes.n === 1;

    const alreadyAwarded = Number(prev.xp ?? 0);
    const potential =
      earnedPoints +
      speedXp + (passed ? course.completionXp : 0) + (passed && score === 100 && questions.length > 0 ? PERFECT_BONUS_XP : 0);
    // Retakes only earn XP for improving on the best result so far.
    const xpAwarded = Math.max(0, potential - alreadyAwarded);
    const coinsAwarded = coinsForXp(xpAwarded);

    const [final] = await tx
      .update(attempts)
      .set({ xpEarned: xpAwarded, coinsEarned: coinsAwarded })
      .where(eq(attempts.id, attemptId))
      .returning();
    await grantXp(tx, userId, xpAwarded, coinsAwarded, passed ? "course_passed" : "course_attempt", attemptId);
    // Seasonal events multiply the XP earned (recorded separately so retakes stay fair).
    await grantEventBonus(tx, userId, xpAwarded, attemptId);

    return { attempt: final, xpAwarded, coinsAwarded, firstPass, newlyCompleted: true };
  });
}
