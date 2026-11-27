import Link from "next/link";
import { desc, eq, sql } from "drizzle-orm";
import { Layers, PenTool, Plus, Users } from "lucide-react";
import { getDb } from "@/db";
import { attempts, courses, users } from "@/db/schema";
import { requirePermission } from "@/lib/session";
import { slideCounts } from "@/lib/courses";
import { ratingSummary } from "@/lib/ratings";
import { getTheme } from "@/lib/themes";
import { Badge, Button, Card, EmptyState, PageHeader } from "@/components/ui";
import { formatDate } from "@/lib/utils";
import { createCourseAction } from "./actions";
import { ImportButton } from "./import-button";

export const metadata = { title: "Course studio" };

const STATUS_TONE = { draft: "accent", published: "success", archived: "muted" } as const;

export default async function StudioPage() {
  await requirePermission("author");
  const db = await getDb();
  const list = await db
    .select({ course: courses, author: users.name })
    .from(courses)
    .leftJoin(users, eq(users.id, courses.createdBy))
    .orderBy(desc(courses.updatedAt));
  const ids = list.map((r) => r.course.id);
  const [counts, ratings] = await Promise.all([slideCounts(ids), ratingSummary(ids)]);
  const learners = ids.length
    ? await db
        .select({
          courseId: attempts.courseId,
          learners: sql<number>`count(distinct ${attempts.userId})`.mapWith(Number),
          passed: sql<number>`count(distinct ${attempts.userId}) filter (where ${attempts.passed})`.mapWith(Number),
        })
        .from(attempts)
        .groupBy(attempts.courseId)
    : [];
  const stats = new Map(learners.map((l) => [l.courseId, l]));

  return (
    <div>
      <PageHeader
        eyebrow="Create"
        title="Course studio"
        subtitle="Build courses from scratch or import a PowerPoint, then add questions and publish."
        actions={
          <>
            <ImportButton />
            <form action={createCourseAction}>
              <Button>
                <Plus className="h-4 w-4" /> New course
              </Button>
            </form>
          </>
        }
      />

      {list.length === 0 ? (
        <EmptyState
          icon={<PenTool className="h-6 w-6" />}
          title="Your studio is empty"
          body="Create a new course or import an existing PowerPoint to get started."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {list.map(({ course: c, author }) => {
            const theme = getTheme(c.theme);
            const s = stats.get(c.id);
            return (
              <Link key={c.id} href={`/studio/${c.id}`} className="group">
                <Card className="overflow-hidden transition group-hover:-translate-y-0.5 group-hover:shadow-[0_20px_40px_-20px_var(--brand)]">
                  <div className="relative flex h-24 items-end p-4" style={{ background: theme.background }}>
                    <span className="text-4xl drop-shadow">{c.icon}</span>
                    <Badge tone={STATUS_TONE[c.status]} className="absolute right-3 top-3 bg-white/90 capitalize">
                      {c.status}
                    </Badge>
                  </div>
                  <div className="p-5">
                    <div className="text-xs font-bold uppercase tracking-wider text-brand">{c.category}</div>
                    <h3 className="mt-0.5 font-display text-lg font-bold">{c.title}</h3>
                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                      <span className="flex items-center gap-1">
                        <Layers className="h-3.5 w-3.5" /> {counts.get(c.id)?.slides ?? 0} slides
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" /> {s?.passed ?? 0}/{s?.learners ?? 0} passed
                      </span>
                      {ratings.get(c.id) && (
                        <span className="flex items-center gap-1">
                          ⭐ {ratings.get(c.id)!.avg.toFixed(1)} ({ratings.get(c.id)!.count})
                        </span>
                      )}
                      <span>Updated {formatDate(c.updatedAt)}</span>
                      {author && <span>by {author}</span>}
                    </div>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
