import "server-only";
import { and, asc, desc, eq, max } from "drizzle-orm";
import { getDb } from "@/db";
import { courseVersions, slides, users, type Slide, type VersionSlide } from "@/db/schema";

type Db = Awaited<ReturnType<typeof getDb>>;
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

export function toVersionSlide(s: Slide | VersionSlide): VersionSlide {
  return {
    id: s.id,
    position: s.position,
    kind: s.kind,
    layout: s.layout,
    title: s.title,
    body: s.body,
    mediaUrl: s.mediaUrl,
    notes: s.notes ?? null,
    question: s.question,
    requireMedia: s.requireMedia ?? false,
  };
}

async function draftSlides(courseId: string, tx?: Db | Tx) {
  const db = tx ?? (await getDb());
  return (await db.select().from(slides).where(eq(slides.courseId, courseId)).orderBy(asc(slides.position))).map(toVersionSlide);
}

export async function latestVersion(courseId: string, tx?: Db | Tx) {
  const db = tx ?? (await getDb());
  const [v] = await db.select().from(courseVersions).where(eq(courseVersions.courseId, courseId)).orderBy(desc(courseVersions.version)).limit(1);
  return v ?? null;
}

/** Freeze the current draft slides as the next version. */
export async function publishVersion(courseId: string, by: string | null, note?: string | null, tx?: Db | Tx) {
  const db = tx ?? (await getDb());
  const [{ n }] = await db.select({ n: max(courseVersions.version) }).from(courseVersions).where(eq(courseVersions.courseId, courseId));
  const [v] = await db
    .insert(courseVersions)
    .values({ courseId, version: (n ?? 0) + 1, slides: await draftSlides(courseId, db), note: note?.trim() || null, publishedBy: by })
    .returning();
  return v;
}

/** The version learners should take now (created on first use for courses published before versioning). */
export async function ensureVersion(courseId: string) {
  return (await latestVersion(courseId)) ?? (await publishVersion(courseId, null, "First published version"));
}

/** Has the draft changed since the last publish? */
export async function hasUnpublishedChanges(courseId: string) {
  const [draft, live] = await Promise.all([draftSlides(courseId), latestVersion(courseId)]);
  if (!live) return false;
  return JSON.stringify(draft) !== JSON.stringify(live.slides.map(toVersionSlide));
}

export async function listVersions(courseId: string) {
  const db = await getDb();
  return db
    .select({
      id: courseVersions.id,
      version: courseVersions.version,
      note: courseVersions.note,
      publishedAt: courseVersions.publishedAt,
      slideCount: courseVersions.slides,
      by: users.name,
    })
    .from(courseVersions)
    .leftJoin(users, eq(users.id, courseVersions.publishedBy))
    .where(eq(courseVersions.courseId, courseId))
    .orderBy(desc(courseVersions.version))
    .then((rows) => rows.map((r) => ({ ...r, slideCount: r.slideCount.length })));
}

/** Replace the draft with an earlier version's slides (the live version is untouched). */
export async function restoreVersion(courseId: string, versionId: string) {
  const db = await getDb();
  const [v] = await db
    .select()
    .from(courseVersions)
    .where(and(eq(courseVersions.id, versionId), eq(courseVersions.courseId, courseId)));
  if (!v) return null;
  await db.transaction(async (tx) => {
    await tx.delete(slides).where(eq(slides.courseId, courseId));
    if (v.slides.length) await tx.insert(slides).values(v.slides.map((s, i) => ({ ...toVersionSlide(s), position: i, courseId })));
  });
  return v;
}
