import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { courses, slides, type QuestionData } from "@/db/schema";
import { requirePermission } from "@/lib/session";
import { toClientQuestion } from "@/lib/quiz";
import type { PlayerSlide } from "@/lib/attempts";
import { getTheme } from "@/lib/themes";
import { Player } from "../../learn/[attemptId]/player";

export const metadata = { title: "Preview" };

/** Authors try the current draft exactly as learners will see it. Nothing is saved. */
export default async function PreviewPage(props: PageProps<"/preview/[courseId]">) {
  await requirePermission("author");
  const { courseId } = await props.params;
  if (!/^[0-9a-f-]{36}$/i.test(courseId)) notFound();
  const db = await getDb();
  const [course] = await db.select().from(courses).where(eq(courses.id, courseId));
  if (!course) notFound();
  const rows = await db.select().from(slides).where(eq(slides.courseId, courseId)).orderBy(asc(slides.position));

  const seed = crypto.randomUUID();
  const questions: Record<string, QuestionData> = {};
  const list: PlayerSlide[] = rows.map((s) => {
    if (s.kind === "question" && s.question) questions[s.id] = s.question;
    return {
      id: s.id,
      kind: s.kind,
      layout: s.layout,
      title: s.title,
      body: s.body,
      mediaUrl: s.mediaUrl,
      requireMedia: s.requireMedia,
      question: s.kind === "question" && s.question ? toClientQuestion(s.question, seed + s.id) : null,
    };
  });

  return (
    <Player
      attemptId="preview"
      courseId={course.id}
      courseTitle={course.title}
      theme={getTheme(course.theme)}
      slides={list}
      initialIndex={0}
      initialFeedback={{}}
      preview={{ questions, passMark: course.passMark }}
    />
  );
}
