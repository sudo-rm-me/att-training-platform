import type { AnswerValue, QuestionData } from "@/db/schema";

/** The fully correct answer for a stored question. */
export function correctAnswer(q: QuestionData): AnswerValue {
  switch (q.type) {
    case "single":
    case "multi":
      return [...q.correct];
    case "truefalse":
      return q.correct;
    case "ordering":
      return q.items.map((i) => i.id);
    case "matching":
      return Object.fromEntries(q.pairs.map((p) => [p.id, p.id]));
  }
}

/** A definitely wrong answer. */
export function wrongAnswer(q: QuestionData): AnswerValue {
  switch (q.type) {
    case "single":
    case "multi":
      return q.options
        .filter((o) => !q.correct.includes(o.id))
        .map((o) => o.id)
        .slice(0, 1);
    case "truefalse":
      return !q.correct;
    case "ordering":
      return [...q.items].reverse().map((i) => i.id);
    case "matching": {
      const ids = q.pairs.map((p) => p.id);
      return Object.fromEntries(ids.map((id, i) => [id, ids[(i + 1) % ids.length]]));
    }
  }
}
