"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { rateCourse } from "@/lib/ratings";
import { requireUser } from "@/lib/session";
import { answerQuestion, AttemptError, completeAttempt, saveProgress } from "@/lib/attempts";
import type { AnswerValue } from "@/db/schema";
import { afterCompletion } from "@/lib/gamification";

const answerSchema = z.union([z.array(z.string().max(64)).max(50), z.boolean(), z.record(z.string().max(64), z.string().max(64))]);

export async function submitAnswerAction(attemptId: string, slideId: string, answer: AnswerValue) {
  const user = await requireUser();
  const parsed = answerSchema.parse(answer) as AnswerValue;
  try {
    return { ok: true as const, feedback: await answerQuestion(z.uuid().parse(attemptId), user.id, z.uuid().parse(slideId), parsed) };
  } catch (e) {
    if (e instanceof AttemptError) return { ok: false as const, error: e.message };
    throw e;
  }
}

export async function saveProgressAction(attemptId: string, index: number) {
  const user = await requireUser();
  await saveProgress(z.uuid().parse(attemptId), user.id, z.number().int().min(0).max(10_000).parse(index));
}

export async function finishAttemptAction(attemptId: string) {
  const user = await requireUser();
  try {
    const res = await completeAttempt(z.uuid().parse(attemptId), user.id);
    if (res.newlyCompleted) {
      // Streaks and badges are best-effort: never block the learner on them.
      await afterCompletion(res.attempt).catch((e) => console.error("afterCompletion failed", e));
    }
    return { ok: true as const };
  } catch (e) {
    if (e instanceof AttemptError) return { ok: false as const, error: e.message };
    throw e;
  }
}

export async function rateCourseAction(courseId: string, stars: number, comment: string) {
  const user = await requireUser();
  const id = z.uuid().safeParse(courseId);
  const n = z.number().int().min(1).max(5).safeParse(stars);
  if (!id.success || !n.success) return { ok: false as const, error: "Pick 1 to 5 stars." };
  const ok = await rateCourse(user.id, id.data, n.data, z.string().max(1000).catch("").parse(comment));
  if (!ok) return { ok: false as const, error: "Finish the course before rating it." };
  revalidatePath("/courses");
  return { ok: true as const };
}
