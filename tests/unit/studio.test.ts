import { describe, expect, it } from "vitest";
import { cleanQuestion, publishProblems, type EditorSlide } from "@/lib/studio-schema";
import { certificateNumber } from "@/lib/certificates";

const content = (title: string) =>
  ({ kind: "content", layout: "content", title, body: "", mediaUrl: null, notes: null, question: null }) as unknown as EditorSlide;
const question = (q: unknown) => ({ ...content("Q"), kind: "question", question: q }) as unknown as EditorSlide;

describe("publishProblems", () => {
  it("requires at least one slide", () => {
    expect(publishProblems([])).toHaveLength(1);
  });

  it("accepts a valid course", () => {
    expect(
      publishProblems([
        content("Intro"),
        question({
          type: "single",
          prompt: "?",
          options: [
            { id: "a", text: "A" },
            { id: "b", text: "B" },
          ],
          correct: ["a"],
        }),
        question({ type: "truefalse", prompt: "?", correct: false }),
      ]),
    ).toEqual([]);
  });

  it("flags incomplete questions with their slide index", () => {
    const p = publishProblems([
      content("Intro"),
      question({ type: "single", prompt: "", options: [{ id: "a", text: "A" }], correct: [] }),
      question({ type: "matching", prompt: "M", pairs: [{ id: "1", left: "x", right: "" }] }),
    ]);
    expect(p.map((x) => x.index)).toEqual([1, 1, 1, 2]);
  });
});

describe("cleanQuestion", () => {
  it("drops blank options and their correct markers", () => {
    const q = cleanQuestion({
      type: "multi",
      prompt: "?",
      options: [
        { id: "a", text: "A" },
        { id: "b", text: "  " },
      ],
      correct: ["a", "b"],
    });
    expect(q).toMatchObject({ options: [{ id: "a" }], correct: ["a"] });
  });
});

describe("certificateNumber", () => {
  it("formats an attempt id as XXXX-XXXX-XXXX", () => {
    expect(certificateNumber("c09ad2e3-97c7-4b2a-9f3e-0123456789ab")).toBe("C09A-D2E3-97C7");
  });
});
