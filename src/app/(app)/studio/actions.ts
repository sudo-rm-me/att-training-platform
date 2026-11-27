"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, asc, count, eq, inArray, notInArray } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { attempts, courses, slides } from "@/db/schema";
import { requirePermission } from "@/lib/session";
import { cleanQuestion, publishProblems, savePayloadSchema, type EditorSlide } from "@/lib/studio-schema";
import { putFile, extForType } from "@/lib/storage";
import { parsePptx } from "@/lib/pptx";

const uuid = z.uuid();

export async function createCourseAction() {
  const user = await requirePermission("author");
  const db = await getDb();
  const course = await db.transaction(async (tx) => {
    const [c] = await tx.insert(courses).values({ title: "Untitled course", createdBy: user.id }).returning();
    await tx.insert(slides).values({
      courseId: c.id,
      position: 0,
      layout: "title",
      title: "Untitled course",
      body: "A short, punchy subtitle",
    });
    return c;
  });
  redirect(`/studio/${course.id}`);
}

export async function saveCourseAction(courseId: string, payload: unknown) {
  await requirePermission("author");
  const id = uuid.parse(courseId);
  const parsed = savePayloadSchema.safeParse(payload);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid data" };
  const { settings, slides: list } = parsed.data;

  const db = await getDb();
  const [course] = await db.select().from(courses).where(eq(courses.id, id)).limit(1);
  if (!course) return { ok: false as const, error: "Course not found" };

  // A live course must stay valid while it is being edited.
  if (course.status === "published") {
    const problems = publishProblems(list);
    if (problems.length)
      return {
        ok: false as const,
        error: `Not saved. This course is live: ${problems[0].index >= 0 ? `slide ${problems[0].index + 1}: ` : ""}${problems[0].message}`,
      };
  }

  await db.transaction(async (tx) => {
    await tx
      .update(courses)
      .set({ ...settings, updatedAt: new Date() })
      .where(eq(courses.id, id));

    const ids = list.map((s) => s.id);
    // Slide ids must not belong to another course.
    if (ids.length) {
      const foreign = await tx
        .select({ id: slides.id })
        .from(slides)
        .where(and(inArray(slides.id, ids), notInArray(slides.courseId, [id])));
      if (foreign.length) throw new Error("Slide id conflict");
    }
    await tx
      .delete(slides)
      .where(ids.length ? and(eq(slides.courseId, id), notInArray(slides.id, ids)) : eq(slides.courseId, id));

    for (const [position, s] of list.entries()) {
      const values = {
        courseId: id,
        position,
        kind: s.kind,
        layout: s.layout,
        title: s.title,
        body: s.body,
        mediaUrl: s.mediaUrl,
        notes: s.notes,
        question: s.kind === "question" && s.question ? (course.status === "published" ? cleanQuestion(s.question) : s.question) : null,
      };
      await tx
        .insert(slides)
        .values({ id: s.id, ...values })
        .onConflictDoUpdate({ target: slides.id, set: values });
    }
  });

  revalidatePath("/studio");
  return { ok: true as const, savedAt: new Date().toISOString() };
}

export async function setCourseStatusAction(courseId: string, status: "draft" | "published" | "archived") {
  await requirePermission("author");
  const id = uuid.parse(courseId);
  const s = z.enum(["draft", "published", "archived"]).parse(status);
  const db = await getDb();

  if (s === "published") {
    const rows = await db.select().from(slides).where(eq(slides.courseId, id)).orderBy(asc(slides.position));
    const problems = publishProblems(rows as unknown as EditorSlide[]);
    if (problems.length) return { ok: false as const, problems };
    // Tidy blank options now that it's going live.
    for (const r of rows)
      if (r.kind === "question" && r.question)
        await db.update(slides).set({ question: cleanQuestion(r.question) }).where(eq(slides.id, r.id));
  }

  await db
    .update(courses)
    .set({ status: s, updatedAt: new Date(), ...(s === "published" && { publishedAt: new Date() }) })
    .where(eq(courses.id, id));
  revalidatePath("/studio");
  revalidatePath("/courses");
  return { ok: true as const };
}

export async function deleteCourseAction(courseId: string) {
  await requirePermission("author");
  const id = uuid.parse(courseId);
  const db = await getDb();
  const [{ n }] = await db.select({ n: count() }).from(attempts).where(eq(attempts.courseId, id));
  if (n > 0) {
    // Keep learners' history: archive instead of deleting.
    await db.update(courses).set({ status: "archived", updatedAt: new Date() }).where(eq(courses.id, id));
  } else {
    await db.delete(courses).where(eq(courses.id, id));
  }
  revalidatePath("/studio");
  redirect("/studio");
}

export async function duplicateCourseAction(courseId: string) {
  const user = await requirePermission("author");
  const id = uuid.parse(courseId);
  const db = await getDb();
  const copy = await db.transaction(async (tx) => {
    const [c] = await tx.select().from(courses).where(eq(courses.id, id));
    if (!c) throw new Error("Course not found");
    const src = await tx.select().from(slides).where(eq(slides.courseId, id)).orderBy(asc(slides.position));
    const [n] = await tx
      .insert(courses)
      .values({
        ...c,
        id: undefined,
        title: `${c.title} (copy)`,
        status: "draft",
        publishedAt: null,
        createdBy: user.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    if (src.length)
      await tx.insert(slides).values(src.map((s) => ({ ...s, id: randomUUID(), courseId: n.id })));
    return n;
  });
  redirect(`/studio/${copy.id}`);
}

export async function uploadMediaAction(fd: FormData) {
  await requirePermission("author");
  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false as const, error: "No file selected" };
  if (!extForType(file.type)) return { ok: false as const, error: "Use a PNG, JPG, GIF, WebP, SVG, MP4 or WebM file." };
  try {
    const url = await putFile(Buffer.from(await file.arrayBuffer()), file.type);
    return { ok: true as const, url };
  } catch (e) {
    return { ok: false as const, error: (e as Error).message };
  }
}

export async function importPptxAction(_prev: unknown, fd: FormData) {
  const user = await requirePermission("author");
  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a .pptx file to import." };
  if (!file.name.toLowerCase().endsWith(".pptx")) return { error: "Only .pptx files are supported (save older .ppt files as .pptx first)." };
  if (file.size > 100 * 1024 * 1024) return { error: "That file is over 100 MB." };

  let deck;
  try {
    deck = await parsePptx(Buffer.from(await file.arrayBuffer()));
  } catch (e) {
    return { error: (e as Error).message || "Couldn't read that presentation." };
  }
  if (deck.slides.length === 0) return { error: "No slides found in that presentation." };

  const title =
    deck.title || deck.slides.find((s) => s.title)?.title || file.name.replace(/\.pptx$/i, "").replace(/[_-]+/g, " ");

  // Upload images first (outside the transaction).
  const mediaUrls: (string | null)[] = [];
  for (const s of deck.slides) {
    mediaUrls.push(s.image ? await putFile(s.image.data, s.image.contentType, "import").catch(() => null) : null);
  }

  const db = await getDb();
  const course = await db.transaction(async (tx) => {
    const [c] = await tx
      .insert(courses)
      .values({
        title: title.slice(0, 200),
        description: `Imported from ${file.name}`,
        createdBy: user.id,
        estimatedMinutes: Math.max(5, Math.round(deck.slides.length * 0.75)),
      })
      .returning();
    await tx.insert(slides).values(
      deck.slides.map((s, i) => ({
        courseId: c.id,
        position: i,
        layout: mediaUrls[i] ? s.layout : s.layout === "image-full" || s.layout === "image-right" ? "content" : s.layout,
        title: s.title.slice(0, 300),
        body: s.body.slice(0, 10000),
        notes: s.notes?.slice(0, 10000) ?? null,
        mediaUrl: mediaUrls[i],
      })),
    );
    return c;
  });
  redirect(`/studio/${course.id}?imported=${deck.slides.length}`);
}
