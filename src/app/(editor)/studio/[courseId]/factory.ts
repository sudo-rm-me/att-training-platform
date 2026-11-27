import type { QuestionData, QuestionType, SlideLayout } from "@/db/schema";
import type { EditorSlide } from "@/lib/studio-schema";

export const shortId = () => Math.random().toString(36).slice(2, 9);

export function defaultQuestion(type: QuestionType, prev?: QuestionData | null): QuestionData {
  const base = { prompt: prev?.prompt ?? "", explanation: prev?.explanation ?? "", points: prev?.points ?? 10 };
  switch (type) {
    case "single":
    case "multi": {
      // Keep existing options when switching between single and multi.
      if (prev && (prev.type === "single" || prev.type === "multi"))
        return { ...base, type, options: prev.options, correct: type === "single" ? prev.correct.slice(0, 1) : prev.correct };
      return {
        ...base,
        type,
        options: Array.from({ length: 4 }, () => ({ id: shortId(), text: "" })),
        correct: [],
      };
    }
    case "truefalse":
      return { ...base, type, correct: true };
    case "ordering":
      return { ...base, type, items: Array.from({ length: 3 }, () => ({ id: shortId(), text: "" })) };
    case "matching":
      return { ...base, type, pairs: Array.from({ length: 3 }, () => ({ id: shortId(), left: "", right: "" })) };
    case "acknowledge":
      return {
        ...base,
        type,
        prompt: prev?.prompt || "Before you finish",
        statement: "I have read and understood this policy and agree to follow it.",
        points: 0,
      };
  }
}

export function newContentSlide(layout: SlideLayout): EditorSlide {
  const titles: Record<SlideLayout, string> = {
    title: "A big, bold title",
    section: "New section",
    content: "New slide",
    "image-left": "Picture this",
    "image-right": "Picture this",
    "image-full": "Full-bleed image",
    video: "Watch this",
    quote: "Who said it",
  };
  const bodies: Partial<Record<SlideLayout, string>> = {
    content: "- First point\n- Second point\n- Third point",
    "image-left": "Describe what the image shows.",
    "image-right": "Describe what the image shows.",
    quote: "Something worth remembering.",
    title: "Subtitle goes here",
  };
  return {
    id: crypto.randomUUID(),
    kind: "content",
    layout,
    title: titles[layout],
    body: bodies[layout] ?? "",
    mediaUrl: null,
    notes: null,
    question: null,
  };
}

export function newQuestionSlide(type: QuestionType): EditorSlide {
  return {
    id: crypto.randomUUID(),
    kind: "question",
    layout: "content",
    title: "Quick check",
    body: "",
    mediaUrl: null,
    notes: null,
    question: defaultQuestion(type),
  };
}

export const LAYOUT_OPTIONS: { value: SlideLayout; label: string }[] = [
  { value: "title", label: "Title" },
  { value: "section", label: "Section header" },
  { value: "content", label: "Text" },
  { value: "image-right", label: "Text + image (right)" },
  { value: "image-left", label: "Text + image (left)" },
  { value: "image-full", label: "Full image" },
  { value: "video", label: "Video" },
  { value: "quote", label: "Quote" },
];

export const QUESTION_OPTIONS: { value: QuestionType; label: string; hint: string }[] = [
  { value: "single", label: "Multiple choice", hint: "One right answer" },
  { value: "multi", label: "Select all that apply", hint: "Several right answers" },
  { value: "truefalse", label: "True or false", hint: "Quick fact check" },
  { value: "ordering", label: "Put in order", hint: "Sequence the steps" },
  { value: "matching", label: "Match the pairs", hint: "Connect related items" },
  { value: "acknowledge", label: "Acknowledgement", hint: "Policy sign-off, timestamped" },
];
