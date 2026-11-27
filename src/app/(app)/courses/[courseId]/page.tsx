import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, desc, eq, isNotNull } from "drizzle-orm";
import { ArrowLeft, Award, CheckCircle2, Clock, HelpCircle, Layers, Play, RotateCcw, Sparkles, Target, Trophy } from "lucide-react";
import { getDb } from "@/db";
import { attempts, courses } from "@/db/schema";
import { requireUser, can } from "@/lib/session";
import { progressFor, slideCounts } from "@/lib/courses";
import { AttemptError, startOrResumeAttempt } from "@/lib/attempts";
import { getTheme } from "@/lib/themes";
import { Badge, Button, Card } from "@/components/ui";
import { formatDate } from "@/lib/utils";
import { DueChip } from "@/components/due-chip";
import { getMyAssignments } from "@/lib/assignments";

export async function generateMetadata(props: PageProps<"/courses/[courseId]">) {
  const { courseId } = await props.params;
  if (!/^[0-9a-f-]{36}$/i.test(courseId)) return {};
  const db = await getDb();
  const [c] = await db.select({ title: courses.title }).from(courses).where(eq(courses.id, courseId)).limit(1);
  return { title: c?.title ?? "Course" };
}

export default async function CoursePage(props: PageProps<"/courses/[courseId]">) {
  const user = await requireUser();
  const { courseId } = await props.params;
  const sp = await props.searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(courseId)) notFound();
  const db = await getDb();
  const [course] = await db.select().from(courses).where(eq(courses.id, courseId)).limit(1);
  if (!course) notFound();
  const isAuthor = can.author(user.role);
  if (course.status !== "published" && !isAuthor) notFound();

  const [counts, progress, history] = await Promise.all([
    slideCounts([course.id]),
    progressFor(user.id, [course.id]),
    db
      .select()
      .from(attempts)
      .where(and(eq(attempts.userId, user.id), eq(attempts.courseId, course.id), isNotNull(attempts.completedAt)))
      .orderBy(desc(attempts.completedAt))
      .limit(10),
  ]);
  const assignment = (await getMyAssignments(user.id, user.department, user.teamId)).find((a) => a.course.id === course.id);
  const c = counts.get(course.id) ?? { slides: 0, questions: 0 };
  const p = progress.get(course.id)!;
  const theme = getTheme(course.theme);
  const outOfAttempts = course.maxAttempts != null && p.attemptsUsed >= course.maxAttempts && !p.openAttemptId;

  async function start(fd: FormData) {
    "use server";
    const u = await requireUser();
    let target: string;
    try {
      const a = await startOrResumeAttempt(u.id, courseId, { restart: fd.get("restart") === "1" });
      target = `/learn/${a.id}`;
    } catch (e) {
      if (e instanceof AttemptError) target = `/courses/${courseId}?error=${encodeURIComponent(e.message)}`;
      else throw e;
    }
    redirect(target);
  }

  return (
    <div>
      <Link href="/courses" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-fg">
        <ArrowLeft className="h-4 w-4" /> All courses
      </Link>

      {typeof sp.error === "string" && (
        <div className="mb-4 rounded-2xl bg-danger/10 px-4 py-3 text-sm font-medium text-danger">{sp.error}</div>
      )}

      <div className="relative overflow-hidden rounded-[2rem] p-8 text-white md:p-12" style={{ background: theme.background, color: theme.fg }}>
        <div className="absolute -right-10 -top-10 h-72 w-72 rounded-full bg-white/15 blur-3xl" />
        <div className="relative grid gap-8 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-bold uppercase tracking-wider backdrop-blur">
                {course.category}
              </span>
              {course.status !== "published" && <Badge tone="accent">{course.status}</Badge>}
              {assignment && (
                <DueChip
                  state={assignment.state}
                  text={assignment.state === "done" && !assignment.validUntil ? "Assigned · done" : `Assigned · ${assignment.text}`}
                  className={assignment.state === "overdue" ? "bg-rose-500 text-white" : "bg-white/90 text-[#1b1440]"}
                />
              )}
              {p.status === "completed" && (
                <span className="flex items-center gap-1 rounded-full bg-emerald-400/90 px-3 py-1 text-xs font-bold text-emerald-950">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Completed
                </span>
              )}
            </div>
            <div className="mt-4 text-6xl">{course.icon}</div>
            <h1 className="mt-3 font-display text-4xl font-extrabold leading-tight md:text-5xl">{course.title}</h1>
            <p className="mt-3 max-w-2xl text-lg opacity-85">{course.description}</p>
            <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm font-semibold opacity-90">
              <span className="flex items-center gap-1.5"><Clock className="h-4 w-4" /> {course.estimatedMinutes} min</span>
              <span className="flex items-center gap-1.5"><Layers className="h-4 w-4" /> {c.slides} slides</span>
              <span className="flex items-center gap-1.5"><HelpCircle className="h-4 w-4" /> {c.questions} questions</span>
              <span className="flex items-center gap-1.5"><Target className="h-4 w-4" /> Pass {course.passMark}%</span>
              <span className="flex items-center gap-1.5"><Sparkles className="h-4 w-4" /> +{course.completionXp} XP bonus</span>
            </div>
          </div>
          <div className="flex flex-col gap-2 md:min-w-56">
            {course.status === "published" && c.slides > 0 && !outOfAttempts && (
              <form action={start}>
                <button className="shine flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-white px-6 text-lg font-bold text-[#1b1440] shadow-xl transition hover:scale-[1.02]">
                  <Play className="h-5 w-5 fill-current" />
                  {p.openAttemptId ? "Resume" : p.attemptsUsed > 0 ? "Start again" : "Start course"}
                </button>
              </form>
            )}
            {p.openAttemptId && (
              <form action={start}>
                <input type="hidden" name="restart" value="1" />
                <Button variant="ghost" className="w-full text-current hover:bg-white/15">
                  <RotateCcw className="h-4 w-4" /> Restart from the beginning
                </Button>
              </form>
            )}
            {outOfAttempts && (
              <div className="rounded-2xl bg-black/25 p-4 text-sm">You&apos;ve used all {course.maxAttempts} attempts.</div>
            )}
            {p.status === "completed" && (
              <a
                href={`/api/certificates/${course.id}`}
                className="flex h-11 items-center justify-center gap-2 rounded-2xl bg-white/20 px-5 text-sm font-bold backdrop-blur transition hover:bg-white/30"
              >
                <Award className="h-4 w-4" /> Download certificate
              </a>
            )}
            {course.maxAttempts != null && (
              <div className="text-center text-xs opacity-75">
                {p.attemptsUsed} of {course.maxAttempts} attempts used
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <Card className="p-6">
          <div className="flex items-center gap-2 text-sm font-semibold text-muted">
            <Trophy className="h-4 w-4 text-accent" /> Best score
          </div>
          <div className="mt-2 font-display text-4xl font-bold">{p.bestScore != null ? `${p.bestScore}%` : "—"}</div>
        </Card>
        <Card className="p-6 lg:col-span-2">
          <div className="mb-3 text-sm font-semibold text-muted">Your attempts</div>
          {history.length === 0 ? (
            <p className="text-sm text-muted">No attempts yet. Your results will show up here.</p>
          ) : (
            <ul className="divide-y divide-border">
              {history.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <span className="text-muted">{formatDate(a.completedAt)}</span>
                  <span className="font-semibold tabular-nums">{a.score}%</span>
                  <Badge tone={a.passed ? "success" : "danger"}>{a.passed ? "Passed" : "Not passed"}</Badge>
                  <span className="text-brand tabular-nums">+{a.xpEarned} XP</span>
                  <Link href={`/learn/${a.id}/results`} className="font-semibold text-brand hover:underline">
                    Review
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
