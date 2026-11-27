import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { courses, slides } from "@/db/schema";
import { requirePermission } from "@/lib/session";
import type { EditorSlide } from "@/lib/studio-schema";
import { Editor } from "./editor";

export async function generateMetadata(props: PageProps<"/studio/[courseId]">) {
  const { courseId } = await props.params;
  if (!/^[0-9a-f-]{36}$/i.test(courseId)) return {};
  const db = await getDb();
  const [c] = await db.select({ title: courses.title }).from(courses).where(eq(courses.id, courseId)).limit(1);
  return { title: c ? `Edit · ${c.title}` : "Editor" };
}

export default async function EditorPage(props: PageProps<"/studio/[courseId]">) {
  await requirePermission("author");
  const { courseId } = await props.params;
  const sp = await props.searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(courseId)) notFound();
  const db = await getDb();
  const [course] = await db.select().from(courses).where(eq(courses.id, courseId)).limit(1);
  if (!course) notFound();
  const rows = await db.select().from(slides).where(eq(slides.courseId, courseId)).orderBy(asc(slides.position));

  const editorSlides: EditorSlide[] = rows.map((s) => ({
    id: s.id,
    kind: s.kind,
    layout: s.layout,
    title: s.title,
    body: s.body,
    mediaUrl: s.mediaUrl,
    notes: s.notes,
    question: s.question,
  }));

  return (
    <Editor
      key={course.id}
      courseId={course.id}
      initialStatus={course.status}
      initialSettings={{
        title: course.title,
        description: course.description,
        category: course.category,
        icon: course.icon,
        theme: course.theme,
        coverImage: course.coverImage,
        estimatedMinutes: course.estimatedMinutes,
        passMark: course.passMark,
        maxAttempts: course.maxAttempts,
        completionXp: course.completionXp,
      }}
      initialSlides={editorSlides}
      importedCount={typeof sp.imported === "string" ? Number(sp.imported) || null : null}
    />
  );
}
