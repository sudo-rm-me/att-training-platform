import { notFound, redirect } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { Check, Clock, Coins, RotateCcw, Sparkles, Target, X } from "lucide-react";
import { getDb } from "@/db";
import { attemptAnswers, attempts, courses, slides } from "@/db/schema";
import { requireUser } from "@/lib/session";
import { completedAttemptCount, startOrResumeAttempt } from "@/lib/attempts";
import { describeAnswer, describeCorrect, QUESTION_TYPE_LABEL } from "@/lib/quiz";
import { Badge, Button, Card, LinkButton } from "@/components/ui";
import { Confetti, CountUp, ScoreRing } from "./celebrate";

export const metadata = { title: "Results" };

function duration(a: Date, b: Date) {
  const s = Math.max(1, Math.round((b.getTime() - a.getTime()) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return m < 60 ? `${m}m ${s % 60}s` : `${Math.floor(m / 60)}h ${m % 60}m`;
}

export default async function ResultsPage(props: PageProps<"/learn/[attemptId]/results">) {
  const user = await requireUser();
  const { attemptId } = await props.params;
  if (!/^[0-9a-f-]{36}$/i.test(attemptId)) notFound();
  const db = await getDb();

  const [row] = await db
    .select({ attempt: attempts, course: courses })
    .from(attempts)
    .innerJoin(courses, eq(courses.id, attempts.courseId))
    .where(and(eq(attempts.id, attemptId), eq(attempts.userId, user.id)))
    .limit(1);
  if (!row) notFound();
  const { attempt, course } = row;
  if (!attempt.completedAt) redirect(`/learn/${attemptId}`);

  const questionSlides = (
    await db.select().from(slides).where(eq(slides.courseId, course.id)).orderBy(asc(slides.position))
  ).filter((s) => s.kind === "question" && s.question);
  const answers = await db.select().from(attemptAnswers).where(eq(attemptAnswers.attemptId, attemptId));
  const answerBySlide = new Map(answers.map((a) => [a.slideId, a]));

  const used = await completedAttemptCount(user.id, course.id);
  const canRetake = course.status === "published" && (course.maxAttempts == null || used < course.maxAttempts);
  const passed = Boolean(attempt.passed);
  const score = attempt.score ?? 0;

  async function retake() {
    "use server";
    const u = await requireUser();
    const a = await startOrResumeAttempt(u.id, course.id, { restart: true });
    redirect(`/learn/${a.id}`);
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <Confetti fire={passed} />

      <Card className="relative overflow-hidden p-8 text-center md:p-10">
        <div className="pointer-events-none absolute inset-x-0 -top-40 mx-auto h-80 w-80 rounded-full bg-brand/25 blur-3xl" />
        <div className="relative flex flex-col items-center">
          <Badge tone={passed ? "success" : "danger"} className="mb-4 px-3 py-1 text-sm">
            {passed ? "Passed" : "Not passed yet"}
          </Badge>
          <h1 className="font-display text-3xl font-extrabold md:text-4xl">
            {passed ? (score === 100 ? "Flawless! 🏆" : "Great work! 🎉") : "So close — have another go 💪"}
          </h1>
          <p className="mt-2 text-muted">{course.title}</p>

          <div className="mt-8">
            <ScoreRing score={score} passed={passed} passMark={course.passMark} />
          </div>

          <div className="mt-8 grid w-full grid-cols-2 gap-3 md:grid-cols-4">
            <div className="rounded-2xl bg-fg/5 p-4">
              <Target className="mx-auto h-5 w-5 text-brand" />
              <div className="mt-1 font-display text-2xl font-bold tabular-nums">
                {attempt.correctCount ?? 0}/{attempt.questionCount ?? 0}
              </div>
              <div className="text-xs text-muted">Correct</div>
            </div>
            <div className="rounded-2xl bg-brand/10 p-4">
              <Sparkles className="mx-auto h-5 w-5 text-brand" />
              <div className="mt-1 font-display text-2xl font-bold text-brand tabular-nums">
                <CountUp to={attempt.xpEarned} prefix="+" />
              </div>
              <div className="text-xs text-muted">XP earned</div>
            </div>
            <div className="rounded-2xl bg-accent/15 p-4">
              <Coins className="mx-auto h-5 w-5 text-accent" />
              <div className="mt-1 font-display text-2xl font-bold tabular-nums">
                <CountUp to={attempt.coinsEarned} prefix="+" />
              </div>
              <div className="text-xs text-muted">Coins</div>
            </div>
            <div className="rounded-2xl bg-fg/5 p-4">
              <Clock className="mx-auto h-5 w-5 text-brand" />
              <div className="mt-1 font-display text-2xl font-bold tabular-nums">
                {duration(attempt.startedAt, attempt.completedAt)}
              </div>
              <div className="text-xs text-muted">Time</div>
            </div>
          </div>
          {attempt.xpEarned === 0 && used > 1 && (
            <p className="mt-4 text-sm text-muted">Retakes only earn XP when you beat your previous best.</p>
          )}

          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <LinkButton href="/courses" variant="secondary" size="lg">
              Back to courses
            </LinkButton>
            {canRetake && (
              <form action={retake}>
                <Button size="lg" variant={passed ? "outline" : "primary"}>
                  <RotateCcw className="h-4 w-4" /> Retake
                </Button>
              </form>
            )}
            <LinkButton href="/" size="lg" variant={passed ? "primary" : "ghost"}>
              Dashboard
            </LinkButton>
          </div>
          {!canRetake && !passed && course.maxAttempts != null && (
            <p className="mt-3 text-sm text-muted">You&apos;ve used all {course.maxAttempts} attempts. Speak to your manager.</p>
          )}
        </div>
      </Card>

      {questionSlides.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-4 font-display text-xl font-bold">Question breakdown</h2>
          <div className="space-y-3">
            {questionSlides.map((s, i) => {
              const q = s.question!;
              const a = answerBySlide.get(s.id);
              const ok = Boolean(a?.correct);
              return (
                <Card key={s.id} className="p-5">
                  <div className="flex items-start gap-4">
                    <div
                      className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-white ${ok ? "bg-success" : "bg-danger"}`}
                    >
                      {ok ? <Check className="h-5 w-5" /> : <X className="h-5 w-5" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                        <span className="font-semibold">Q{i + 1}</span>
                        <Badge tone="muted">{QUESTION_TYPE_LABEL[q.type]}</Badge>
                        <span>{a?.points ?? 0} pts</span>
                      </div>
                      <div className="mt-1 font-semibold">{q.prompt}</div>
                      <div className="mt-3 grid gap-3 text-sm md:grid-cols-2">
                        <div>
                          <div className="text-xs font-bold uppercase tracking-wider text-muted">Your answer</div>
                          <ul className="mt-1 space-y-0.5">
                            {describeAnswer(q, a?.answer).map((t, n) => (
                              <li key={n} className={ok ? "text-success" : "text-danger"}>
                                {t}
                              </li>
                            ))}
                          </ul>
                        </div>
                        {!ok && (
                          <div>
                            <div className="text-xs font-bold uppercase tracking-wider text-muted">Correct answer</div>
                            <ul className="mt-1 space-y-0.5">
                              {describeCorrect(q).map((t, n) => (
                                <li key={n}>{t}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                      {q.explanation && <p className="mt-3 rounded-xl bg-fg/5 px-3 py-2 text-sm text-muted">{q.explanation}</p>}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
