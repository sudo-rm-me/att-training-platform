import { describe, expect, it } from "vitest";
import type { QuestionData } from "@/db/schema";
import { describeAnswer, describeCorrect, grade, questionPoints, seededShuffle, toClientQuestion } from "@/lib/quiz";
import { correctAnswer, wrongAnswer } from "../support/answers";

const opts = [
  { id: "a", text: "Alpha" },
  { id: "b", text: "Bravo" },
  { id: "c", text: "Charlie" },
  { id: "d", text: "Delta" },
];

const QUESTIONS: QuestionData[] = [
  { type: "single", prompt: "Pick one", options: opts, correct: ["b"] },
  { type: "multi", prompt: "Pick some", options: opts, correct: ["a", "c"], points: 20 },
  { type: "truefalse", prompt: "True?", correct: true },
  { type: "ordering", prompt: "Order", items: opts },
  {
    type: "matching",
    prompt: "Match",
    pairs: [
      { id: "p1", left: "Cat", right: "Meow" },
      { id: "p2", left: "Dog", right: "Woof" },
      { id: "p3", left: "Cow", right: "Moo" },
    ],
  },
];

describe("grade", () => {
  it.each(QUESTIONS.map((q) => [q.type, q] as const))("accepts the correct %s answer and rejects a wrong one", (_t, q) => {
    expect(grade(q, correctAnswer(q))).toBe(true);
    expect(grade(q, wrongAnswer(q))).toBe(false);
  });

  it("requires exactly the correct set for multi-select", () => {
    const q = QUESTIONS[1];
    expect(grade(q, ["a"])).toBe(false);
    expect(grade(q, ["a", "c", "d"])).toBe(false);
    expect(grade(q, ["c", "a"])).toBe(true);
  });

  it("rejects malformed answers instead of throwing", () => {
    for (const q of QUESTIONS) {
      expect(grade(q, "nonsense" as never)).toBe(false);
      expect(grade(q, null as never)).toBe(false);
    }
  });
});

describe("toClientQuestion", () => {
  it("never leaks answers to the browser", () => {
    for (const q of QUESTIONS) {
      const json = JSON.stringify(toClientQuestion(q, "seed"));
      expect(json).not.toContain('"correct"');
      expect(json).not.toContain('"explanation"');
    }
  });

  it("shuffles deterministically per seed", () => {
    const q = QUESTIONS[3];
    expect(toClientQuestion(q, "x")).toEqual(toClientQuestion(q, "x"));
  });

  it("splits matching pairs into lefts and shuffled rights", () => {
    const c = toClientQuestion(QUESTIONS[4], "s");
    expect(c.type).toBe("matching");
    if (c.type !== "matching") return;
    expect(c.lefts.map((l) => l.text)).toEqual(["Cat", "Dog", "Cow"]);
    expect(c.rights.map((r) => r.text).sort()).toEqual(["Meow", "Moo", "Woof"]);
  });
});

describe("seededShuffle", () => {
  it("keeps every element", () => {
    expect(
      seededShuffle(opts, "abc")
        .map((o) => o.id)
        .sort(),
    ).toEqual(["a", "b", "c", "d"]);
  });

  it("never returns an ordering already in the right order", () => {
    for (let i = 0; i < 200; i++) {
      expect(seededShuffle(["1", "2", "3"], `seed-${i}`)).not.toEqual(["1", "2", "3"]);
    }
  });
});

describe("descriptions and points", () => {
  it("describes correct answers and learner answers", () => {
    expect(describeCorrect(QUESTIONS[0])).toEqual(["Bravo"]);
    expect(describeCorrect(QUESTIONS[2])).toEqual(["True"]);
    expect(describeAnswer(QUESTIONS[0], undefined)).toEqual(["(not answered)"]);
    expect(describeAnswer(QUESTIONS[4], { p1: "p2", p2: "p1", p3: "p3" })[0]).toBe("Cat → Woof");
  });

  it("defaults to 10 points", () => {
    expect(questionPoints(QUESTIONS[0])).toBe(10);
    expect(questionPoints(QUESTIONS[1])).toBe(20);
  });
});
