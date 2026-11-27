import type { AnswerValue, QuestionData } from "@/db/schema";

export const DEFAULT_POINTS = 10;

export function questionPoints(q: QuestionData) {
  return q.points ?? DEFAULT_POINTS;
}

/** Deterministic PRNG so shuffles are stable for an attempt (resume/refresh). */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

export function seededShuffle<T>(arr: T[], seed: string): T[] {
  const out = [...arr];
  const rnd = mulberry32(hash(seed));
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  // Never present an ordering question already in the right order.
  if (out.length > 1 && out.every((v, i) => v === arr[i])) out.push(out.shift()!);
  return out;
}

/** What the browser is allowed to see about a question (no answers). */
export type ClientQuestion =
  | { type: "single" | "multi"; prompt: string; options: { id: string; text: string }[]; points: number }
  | { type: "truefalse"; prompt: string; points: number }
  | { type: "ordering"; prompt: string; items: { id: string; text: string }[]; points: number }
  | {
      type: "matching";
      prompt: string;
      lefts: { id: string; text: string }[];
      rights: { id: string; text: string }[];
      points: number;
    };

export function toClientQuestion(q: QuestionData, seed: string): ClientQuestion {
  const points = questionPoints(q);
  switch (q.type) {
    case "single":
    case "multi":
      return { type: q.type, prompt: q.prompt, options: seededShuffle(q.options, seed), points };
    case "truefalse":
      return { type: "truefalse", prompt: q.prompt, points };
    case "ordering":
      return { type: "ordering", prompt: q.prompt, items: seededShuffle(q.items, seed), points };
    case "matching":
      return {
        type: "matching",
        prompt: q.prompt,
        lefts: q.pairs.map((p) => ({ id: p.id, text: p.left })),
        rights: seededShuffle(
          q.pairs.map((p) => ({ id: p.id, text: p.right })),
          seed + ":r",
        ),
        points,
      };
  }
}

/** Server-side grading. Returns whether the answer is fully correct. */
export function grade(q: QuestionData, answer: AnswerValue): boolean {
  switch (q.type) {
    case "single":
    case "multi": {
      if (!Array.isArray(answer)) return false;
      const a = new Set(answer);
      const c = new Set(q.correct);
      return a.size === c.size && [...c].every((id) => a.has(id));
    }
    case "truefalse":
      return typeof answer === "boolean" && answer === q.correct;
    case "ordering":
      return (
        Array.isArray(answer) &&
        answer.length === q.items.length &&
        q.items.every((item, i) => item.id === answer[i])
      );
    case "matching": {
      if (!answer || typeof answer !== "object" || Array.isArray(answer)) return false;
      const map = answer as Record<string, string>;
      return q.pairs.every((p) => map[p.id] === p.id);
    }
  }
}

/** Human-readable correct answer, for feedback and results. */
export function describeCorrect(q: QuestionData): string[] {
  switch (q.type) {
    case "single":
    case "multi":
      return q.options.filter((o) => q.correct.includes(o.id)).map((o) => o.text);
    case "truefalse":
      return [q.correct ? "True" : "False"];
    case "ordering":
      return q.items.map((i, n) => `${n + 1}. ${i.text}`);
    case "matching":
      return q.pairs.map((p) => `${p.left} → ${p.right}`);
  }
}

export function describeAnswer(q: QuestionData, answer: AnswerValue | undefined): string[] {
  if (answer === undefined) return ["(not answered)"];
  switch (q.type) {
    case "single":
    case "multi":
      return Array.isArray(answer)
        ? q.options.filter((o) => answer.includes(o.id)).map((o) => o.text)
        : [];
    case "truefalse":
      return [answer === true ? "True" : "False"];
    case "ordering":
      return Array.isArray(answer)
        ? answer.map((id, n) => `${n + 1}. ${q.items.find((i) => i.id === id)?.text ?? "?"}`)
        : [];
    case "matching": {
      const map = (answer ?? {}) as Record<string, string>;
      return q.pairs.map((p) => `${p.left} → ${q.pairs.find((x) => x.id === map[p.id])?.right ?? "?"}`);
    }
  }
}

export const QUESTION_TYPE_LABEL: Record<QuestionData["type"], string> = {
  single: "Multiple choice",
  multi: "Select all that apply",
  truefalse: "True or false",
  ordering: "Put in order",
  matching: "Match the pairs",
};
