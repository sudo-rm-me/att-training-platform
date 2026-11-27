import { notFound, redirect } from "next/navigation";
import { and, eq, lt, min, sum } from "drizzle-orm";
import { Check, Clock, Coins, Flame, RotateCcw, Sparkles, Target, X, Zap } from "lucide-react";
import { getDb } from "@/db";
import { attemptAnswers, attempts, courses, userBadges, users, xpEvents } from "@/db/schema";
import { BADGE_BY_KEY } from "@/lib/badges";
import { levelFromXp } from "@/lib/levels";
import { BadgeMedal } from "@/components/badge-medal";
import { requireUser } from "@/lib/session";
import { attemptSlides, completedAttemptCount, startOrResumeAttempt } from "@/lib/attempts";
import { describeAnswer, describeCorrect, QUESTION_TYPE_LABEL } from "@/lib/quiz";
import { Badge, Button, Card, LinkButton } from "@/components/ui";
import { Confetti, CountUp, LevelUpModal, ScoreRing } from "./celebrate";
import { RateCourse } from "./rate-course";
import { myRating } from "@/lib/ratings";

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

  const questionSlides = (await attemptSlides(attempt)).filter((s) => s.kind === "question" && s.question);
  const answers = await db.select().from(attemptAnswers).where(eq(attemptAnswers.attemptId, attemptId));
  const answerBySlide = new Map(answers.map((a) => [a.slideId, a]));

  // Rewards granted for this attempt (course XP, streak bonus, badges).
  const events = await db.select().from(xpEvents).where(eq(xpEvents.refId, attemptId));
  const earnedBadges = (await db.select().from(userBadges).where(and(eq(userBadges.userId, user.id), eq(userBadges.refId, attemptId))))
    .map((b) => BADGE_BY_KEY.get(b.badge))
    .filter((b) => b != null);
  const streakEvent = events.find((e) => e.reason === "streak");
  const eventBonus = events.find((e) => e.reason === "event");
  const speedXp = answers.reduce((n, a) => n + a.bonus, 0);
  const totalXp = events.reduce((n, e) => n + e.xp, 0);
  const totalCoins = events.reduce((n, e) => n + e.coins, 0);
  let levelUp: { from: number; to: number } | null = null;
  if (events.length) {
    const [first] = await db.select({ at: min(xpEvents.createdAt) }).from(xpEvents).where(eq(xpEvents.refId, attemptId));
    const [before] = await db
      .select({ xp: sum(xpEvents.xp) })
      .from(xpEvents)
      .where(and(eq(xpEvents.userId, user.id), lt(xpEvents.createdAt, first.at!)));
    const from = levelFromXp(Number(before.xp ?? 0)).level;
    const to = levelFromXp(Number(before.xp ?? 0) + totalXp).level;
    if (to > from) levelUp = { from, to };
  }
  const [me] = await db.select({ streak: users.currentStreak }).from(users).where(eq(users.id, user.id));

  const [used, rating] = await Promise.all([completedAttemptCount(user.id, course.id), myRating(user.id, course.id)]);
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
      {levelUp && <LevelUpModal attemptId={attemptId} from={levelUp.from} to={levelUp.to} title={levelFromXp(user.xp).title} />}

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
                <CountUp to={totalXp || attempt.xpEarned} prefix="+" />
              </div>
              <div className="text-xs text-muted">XP earned</div>
            </div>
            <div className="rounded-2xl bg-accent/15 p-4">
              <Coins className="mx-auto h-5 w-5 text-accent" />
              <div className="mt-1 font-display text-2xl font-bold tabular-nums">
                <CountUp to={totalCoins || attempt.coinsEarned} prefix="+" />
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
          {(levelUp || streakEvent || eventBonus || speedXp > 0 || earnedBadges.length > 0) && (
            <div className="mt-6 w-full space-y-3">
              {levelUp && (
                <div className="shine flex items-center justify-center gap-3 rounded-2xl bg-brand-gradient px-5 py-4 text-white">
                  <span className="text-3xl">🚀</span>
                  <span className="font-display text-xl font-bold">
                    Level up! {levelUp.from} → {levelUp.to}
                  </span>
                  <span className="text-sm opacity-80">{levelFromXp(user.xp).title}</span>
                </div>
              )}
              {streakEvent && (
                <div className="flex items-center justify-center gap-2 rounded-2xl bg-[var(--brand-3)]/12 px-4 py-3 text-sm font-semibold">
                  <Flame className="h-5 w-5 text-[var(--brand-3)]" /> {me.streak}-day streak! +{streakEvent.xp} bonus XP
                </div>
              )}
              {speedXp > 0 && (
                <div className="flex items-center justify-center gap-2 rounded-2xl bg-accent/15 px-4 py-3 text-sm font-semibold">
                  <Zap className="h-5 w-5 text-accent" /> Quick thinking! {speedXp} speed bonus points
                </div>
              )}
              {eventBonus && (
                <div className="flex items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(120deg,#f59e0b22,#ec489922,#8b5cf622)] px-4 py-3 text-sm font-semibold">
                  🎉 Event bonus: +{eventBonus.xp} XP
                </div>
              )}
              {earnedBadges.length > 0 && (
                <div className="rounded-2xl bg-fg/5 p-4">
                  <div className="mb-3 text-xs font-bold uppercase tracking-widest text-muted">New badges</div>
                  <div className="flex flex-wrap justify-center gap-5">
                    {earnedBadges.map((b) => (
                      <div key={b.key} className="flex w-28 flex-col items-center text-center">
                        <BadgeMedal badge={b} />
                        <div className="mt-2 text-sm font-bold">{b.name}</div>
                        <div className="text-xs text-muted">+{b.xp} XP</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
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
          <div className="mt-8 border-t border-border pt-6">
            <RateCourse courseId={course.id} initialStars={rating?.stars ?? null} initialComment={rating?.comment ?? null} />
          </div>
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
                      {q.type === "acknowledge" && a?.correct && (
                        <p className="mt-3 text-xs font-semibold text-muted">
                          ✍️ Signed by {user.name} on{" "}
                          {a.answeredAt.toLocaleString("en-GB", { dateStyle: "long", timeStyle: "short", timeZone: process.env.APP_TIMEZONE || "Europe/London" })}
                        </p>
                      )}
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
