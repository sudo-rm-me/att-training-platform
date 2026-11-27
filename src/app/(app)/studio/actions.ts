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
import { audit } from "@/lib/audit";
import { publishVersion, restoreVersion } from "@/lib/versions";

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
    await audit(user, { action: "course.create", summary: "Created a new course", targetType: "course", targetId: c.id }, tx);
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
        requireMedia: s.requireMedia,
        question: s.kind === "question" && s.question ? s.question : null,
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

export async function setCourseStatusAction(courseId: string, status: "draft" | "published" | "archived", note?: string) {
  const user = await requirePermission("author");
  const id = uuid.parse(courseId);
  const s = z.enum(["draft", "published", "archived"]).parse(status);
  const db = await getDb();
  let version: number | null = null;

  if (s === "published") {
    const rows = await db.select().from(slides).where(eq(slides.courseId, id)).orderBy(asc(slides.position));
    const problems = publishProblems(rows as unknown as EditorSlide[]);
    if (problems.length) return { ok: false as const, problems };
    // Tidy blank options now that it's going live.
    for (const r of rows)
      if (r.kind === "question" && r.question)
        await db.update(slides).set({ question: cleanQuestion(r.question) }).where(eq(slides.id, r.id));
    // Freeze the slides learners will take from now on.
    version = (await publishVersion(id, user.id, z.string().max(300).optional().parse(note))).version;
  }

  await db
    .update(courses)
    .set({ status: s, updatedAt: new Date(), ...(s === "published" && { publishedAt: new Date() }) })
    .where(eq(courses.id, id));
  const [c] = await db.select({ title: courses.title }).from(courses).where(eq(courses.id, id));
  await audit(user, {
    action: s === "published" ? "course.publish" : s === "archived" ? "course.archive" : "course.unpublish",
    summary: `${c?.title ?? id}${version ? ` (version ${version})` : ""}`,
    targetType: "course",
    targetId: id,
  });
  revalidatePath("/studio");
  revalidatePath("/courses");
  return { ok: true as const, version };
}

export async function restoreVersionAction(courseId: string, versionId: string) {
  const user = await requirePermission("author");
  const id = uuid.parse(courseId);
  const v = await restoreVersion(id, uuid.parse(versionId));
  if (!v) return { ok: false as const, error: "Version not found" };
  const db = await getDb();
  await db.update(courses).set({ updatedAt: new Date() }).where(eq(courses.id, id));
  await audit(user, { action: "course.restore", summary: `Draft restored from version ${v.version}`, targetType: "course", targetId: id });
  revalidatePath(`/studio/${id}`);
  return { ok: true as const, message: `Draft restored from version ${v.version}. Publish to make it live.` };
}

export async function deleteCourseAction(courseId: string) {
  const user = await requirePermission("author");
  const id = uuid.parse(courseId);
  const db = await getDb();
  const [c] = await db.select({ title: courses.title }).from(courses).where(eq(courses.id, id));
  const [{ n }] = await db.select({ n: count() }).from(attempts).where(eq(attempts.courseId, id));
  if (n > 0) {
    // Keep learners' history: archive instead of deleting.
    await db.update(courses).set({ status: "archived", updatedAt: new Date() }).where(eq(courses.id, id));
    await audit(user, { action: "course.archive", summary: `${c?.title ?? id} (has attempts, archived instead of deleted)`, targetType: "course", targetId: id });
  } else {
    await db.delete(courses).where(eq(courses.id, id));
    await audit(user, { action: "course.delete", summary: c?.title ?? id, targetType: "course", targetId: id });
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
    await audit(user, { action: "course.duplicate", summary: `${c.title} → ${n.title}`, targetType: "course", targetId: n.id }, tx);
    return n;
  });
  redirect(`/studio/${copy.id}`);
}

export async function uploadMediaAction(fd: FormData) {
  await requirePermission("author");
  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false as const, error: "No file selected" };
  if (!extForType(file.type)) return { ok: false as const, error: "Use an image (PNG, JPG, GIF, WebP, SVG), video (MP4, WebM), audio (MP3, M4A, WAV, OGG) or PDF file." };
  try {
    const url = await putFile(Buffer.from(await file.arrayBuffer()), file.type);
    return { ok: true as const, url };
  } catch (e) {
    return { ok: false as const, error: (e as Error).message };
  }
}

/** A reading module: the PDF in a pop-up reader, then a starter question to replace. */
async function importPdf(user: Awaited<ReturnType<typeof requirePermission>>, file: File) {
  if (file.size > 50 * 1024 * 1024) return { error: "That PDF is over 50 MB." };
  const data = Buffer.from(await file.arrayBuffer());
  if (data.subarray(0, 5).toString("latin1") !== "%PDF-") return { error: "That doesn't look like a PDF file." };
  let url: string;
  try {
    url = await putFile(data, "application/pdf", "import");
  } catch (e) {
    return { error: (e as Error).message };
  }
  const title = file.name.replace(/\.pdf$/i, "").replace(/[_-]+/g, " ").trim().slice(0, 200) || "Reading";
  const db = await getDb();
  const course = await db.transaction(async (tx) => {
    const [c] = await tx
      .insert(courses)
      .values({ title, description: `Read the document, then check your understanding.`, createdBy: user.id, estimatedMinutes: 15, icon: "📄" })
      .returning();
    await tx.insert(slides).values([
      { courseId: c.id, position: 0, layout: "title", title, body: "Read the document, then answer a few questions." },
      {
        courseId: c.id,
        position: 1,
        layout: "document",
        title,
        body: "Open the document and read it carefully. Questions follow.",
        mediaUrl: url,
        requireMedia: true,
      },
      { courseId: c.id, position: 2, layout: "section", title: "Check your understanding", body: "" },
      {
        courseId: c.id,
        position: 3,
        kind: "question",
        title: "Question 1",
        question: {
          type: "single",
          prompt: "Replace this with a question about the document",
          options: [
            { id: "a", text: "Correct answer" },
            { id: "b", text: "Wrong answer" },
            { id: "c", text: "Another wrong answer" },
          ],
          correct: ["a"],
          points: 10,
        },
      },
    ]);
    await audit(user, { action: "course.import", summary: `${c.title} (${file.name}, PDF reading module)`, targetType: "course", targetId: c.id }, tx);
    return c;
  });
  redirect(`/studio/${course.id}?imported=pdf`);
}

export async function importPptxAction(_prev: unknown, fd: FormData) {
  const user = await requirePermission("author");
  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a .pptx or .pdf file to import." };
  if (file.name.toLowerCase().endsWith(".pdf")) return importPdf(user, file);
  if (!file.name.toLowerCase().endsWith(".pptx")) return { error: "Use a .pptx or .pdf file (save older .ppt files as .pptx first)." };
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

  // Upload media first (outside the transaction).
  const mediaUrls: (string | null)[] = [];
  const bodies: string[] = [];
  for (const s of deck.slides) {
    mediaUrls.push(s.image ? await putFile(s.image.data, s.image.contentType, "import").catch(() => null) : null);
    const extra = await Promise.all(s.extraImages.map((im) => putFile(im.data, im.contentType, "import").catch(() => null)));
    bodies.push(s.body.replace(/\{\{image:(\d+)\}\}/g, (_, n) => (extra[Number(n)] ? `![](${extra[Number(n)]})` : "")).trim());
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
        layout: mediaUrls[i] ? s.layout : ["image-full", "image-right", "video", "audio"].includes(s.layout) ? "content" : s.layout,
        title: s.title.slice(0, 300),
        body: bodies[i].slice(0, 10000),
        notes: s.notes?.slice(0, 10000) ?? null,
        mediaUrl: mediaUrls[i],
      })),
    );
    await audit(user, { action: "course.import", summary: `${c.title} (${file.name}, ${deck.slides.length} slides)`, targetType: "course", targetId: c.id }, tx);
    return c;
  });
  redirect(`/studio/${course.id}?imported=${deck.slides.length}`);
}
