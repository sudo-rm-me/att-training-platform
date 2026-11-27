import Link from "next/link";
import { redirect } from "next/navigation";
import { BookOpen, Search, Wand2 } from "lucide-react";
import { requireUser, can } from "@/lib/session";
import { listCatalog } from "@/lib/courses";
import { installSampleCourse } from "@/lib/sample-course";
import { Button, EmptyState, Input, PageHeader } from "@/components/ui";
import { CourseCard } from "@/components/course-card";
import { cn } from "@/lib/utils";

export const metadata = { title: "Courses" };

const FILTERS = [
  { key: "all", label: "All" },
  { key: "todo", label: "To do" },
  { key: "in_progress", label: "In progress" },
  { key: "completed", label: "Completed" },
] as const;

export default async function CoursesPage(props: PageProps<"/courses">) {
  const user = await requireUser();
  const sp = await props.searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().toLowerCase() : "";
  const filter = typeof sp.filter === "string" ? sp.filter : "all";
  const category = typeof sp.category === "string" ? sp.category : "";

  const all = await listCatalog(user.id);
  const categories = [...new Set(all.map((c) => c.category))].sort();
  const list = all.filter((c) => {
    if (q && !`${c.title} ${c.description} ${c.category}`.toLowerCase().includes(q)) return false;
    if (category && c.category !== category) return false;
    if (filter === "todo") return c.progress.status === "not_started" || c.progress.status === "failed";
    if (filter === "in_progress") return c.progress.status === "in_progress";
    if (filter === "completed") return c.progress.status === "completed";
    return true;
  });

  async function addSample() {
    "use server";
    const u = await requireUser();
    if (!can.author(u.role)) return;
    const c = await installSampleCourse(u.id);
    redirect(`/courses/${c.id}`);
  }

  const href = (patch: Record<string, string>) => {
    const p = new URLSearchParams({ ...(q && { q }), ...(filter !== "all" && { filter }), ...(category && { category }), ...patch });
    for (const [k, v] of [...p]) if (!v || v === "all") p.delete(k);
    const s = p.toString();
    return s ? `/courses?${s}` : "/courses";
  };

  return (
    <div>
      <PageHeader eyebrow="Learn" title="Courses" subtitle="Pick something up, finish it in one sitting and collect XP along the way." />

      {all.length === 0 ? (
        <EmptyState
          icon={<BookOpen className="h-6 w-6" />}
          title="No courses yet"
          body={can.author(user.role) ? "Create your first course in the studio, or add a sample course to try things out." : "Check back soon: your training team is preparing courses."}
          action={
            can.author(user.role) ? (
              <form action={addSample}>
                <Button>
                  <Wand2 className="h-4 w-4" /> Add sample course
                </Button>
              </form>
            ) : undefined
          }
        />
      ) : (
        <>
          <div className="mb-6 flex flex-wrap items-center gap-3">
            <div className="glass flex gap-1 rounded-2xl p-1">
              {FILTERS.map((f) => (
                <Link
                  key={f.key}
                  href={href({ filter: f.key })}
                  className={cn(
                    "rounded-xl px-3.5 py-1.5 text-sm font-semibold transition",
                    filter === f.key ? "bg-brand-gradient text-white" : "text-muted hover:text-fg",
                  )}
                >
                  {f.label}
                </Link>
              ))}
            </div>
            {categories.length > 1 && (
              <div className="flex flex-wrap gap-1.5">
                {categories.map((c) => (
                  <Link
                    key={c}
                    href={href({ category: category === c ? "" : c })}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs font-semibold transition",
                      category === c ? "border-brand bg-brand/10 text-brand" : "border-border text-muted hover:text-fg",
                    )}
                  >
                    {c}
                  </Link>
                ))}
              </div>
            )}
            <form className="ml-auto flex w-full items-center gap-2 sm:w-64">
              {filter !== "all" && <input type="hidden" name="filter" value={filter} />}
              {category && <input type="hidden" name="category" value={category} />}
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                <Input name="q" defaultValue={q} placeholder="Search courses" className="pl-9" />
              </div>
            </form>
          </div>

          {list.length === 0 ? (
            <EmptyState title="Nothing here" body="No courses match those filters." />
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {list.map((c) => (
                <CourseCard key={c.id} course={c} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
