import { z } from "zod";
import type { QuestionData } from "@/db/schema";

/** Shared (client + server) validation for the course editor payload. */

const id = z.string().min(1).max(64);
const text = (max: number) => z.string().max(max);
const opt = z.object({ id, text: text(500) });

export const questionSchema: z.ZodType<QuestionData> = z.discriminatedUnion("type", [
  z.object({
    type: z.enum(["single", "multi"]),
    prompt: text(1000),
    options: z.array(opt).max(12),
    correct: z.array(id).max(12),
    explanation: text(2000).optional(),
    points: z.number().int().min(0).max(1000).optional(),
  }),
  z.object({
    type: z.literal("truefalse"),
    prompt: text(1000),
    correct: z.boolean(),
    explanation: text(2000).optional(),
    points: z.number().int().min(0).max(1000).optional(),
  }),
  z.object({
    type: z.literal("ordering"),
    prompt: text(1000),
    items: z.array(opt).max(12),
    explanation: text(2000).optional(),
    points: z.number().int().min(0).max(1000).optional(),
  }),
  z.object({
    type: z.literal("matching"),
    prompt: text(1000),
    pairs: z.array(z.object({ id, left: text(300), right: text(300) })).max(10),
    explanation: text(2000).optional(),
    points: z.number().int().min(0).max(1000).optional(),
  }),
]);

export const LAYOUTS = ["title", "content", "image-left", "image-right", "image-full", "video", "quote", "section"] as const;

const mediaUrl = z
  .string()
  .max(2000)
  .refine((u) => u.startsWith("/api/media/") || /^https:\/\//i.test(u), "Media must be an uploaded file or an https:// URL")
  .nullable();

export const slideSchema = z.object({
  id: z.uuid(),
  kind: z.enum(["content", "question"]),
  layout: z.enum(LAYOUTS),
  title: text(300),
  body: text(10000),
  mediaUrl,
  notes: text(10000).nullable(),
  question: questionSchema.nullable(),
});
export type EditorSlide = z.infer<typeof slideSchema>;

export const settingsSchema = z.object({
  title: z.string().trim().min(1, "Give the course a title").max(200),
  description: text(2000),
  category: z.string().trim().min(1).max(60),
  icon: z.string().min(1).max(16),
  theme: z.string().max(32),
  coverImage: mediaUrl,
  estimatedMinutes: z.number().int().min(1).max(600),
  passMark: z.number().int().min(0).max(100),
  maxAttempts: z.number().int().min(1).max(100).nullable(),
  completionXp: z.number().int().min(0).max(10000),
});
export type CourseSettings = z.infer<typeof settingsSchema>;

export const savePayloadSchema = z.object({
  settings: settingsSchema,
  slides: z.array(slideSchema).max(300),
});
export type SavePayload = z.infer<typeof savePayloadSchema>;

/** Problems that block publishing. Index refers to slide position. */
export function publishProblems(slides: EditorSlide[]): { index: number; message: string }[] {
  const out: { index: number; message: string }[] = [];
  if (slides.length === 0) out.push({ index: -1, message: "Add at least one slide." });
  slides.forEach((s, index) => {
    if (s.kind !== "question") return;
    const q = s.question;
    if (!q) return out.push({ index, message: "Question slide has no question." });
    if (!q.prompt.trim()) out.push({ index, message: "Question needs a prompt." });
    switch (q.type) {
      case "single":
      case "multi": {
        const filled = q.options.filter((o) => o.text.trim());
        if (filled.length < 2) out.push({ index, message: "Add at least two answer options." });
        const correct = q.correct.filter((c) => q.options.some((o) => o.id === c && o.text.trim()));
        if (q.type === "single" && correct.length !== 1) out.push({ index, message: "Mark exactly one correct answer." });
        if (q.type === "multi" && correct.length < 1) out.push({ index, message: "Mark at least one correct answer." });
        break;
      }
      case "ordering":
        if (q.items.filter((i) => i.text.trim()).length < 2) out.push({ index, message: "Add at least two items to order." });
        break;
      case "matching":
        if (q.pairs.filter((p) => p.left.trim() && p.right.trim()).length < 2)
          out.push({ index, message: "Add at least two complete pairs." });
        break;
    }
  });
  return out;
}

/** Removes blank options/items/pairs before saving a published course. */
export function cleanQuestion(q: QuestionData): QuestionData {
  switch (q.type) {
    case "single":
    case "multi": {
      const options = q.options.filter((o) => o.text.trim());
      return { ...q, options, correct: q.correct.filter((c) => options.some((o) => o.id === c)) };
    }
    case "ordering":
      return { ...q, items: q.items.filter((i) => i.text.trim()) };
    case "matching":
      return { ...q, pairs: q.pairs.filter((p) => p.left.trim() && p.right.trim()) };
    default:
      return q;
  }
}
