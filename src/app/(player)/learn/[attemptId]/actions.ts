"use server";

import { z } from "zod";
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
