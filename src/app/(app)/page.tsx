import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { AlarmClock, BookCheck, Flame, Sparkles, Trophy } from "lucide-react";
import { getDb } from "@/db";
import { userBadges } from "@/db/schema";
import { BADGE_BY_KEY, BADGES } from "@/lib/badges";
import { hourIn, liveStreak } from "@/lib/gamification";
import { BadgeMedal } from "@/components/badge-medal";
import { requireUser } from "@/lib/session";
import { levelFromXp } from "@/lib/levels";
import { Card, LinkButton, Progress, StatTile } from "@/components/ui";
import { listCatalog } from "@/lib/courses";
import { CourseCard } from "@/components/course-card";
import { UserAvatar } from "@/components/user-avatar";
import { DueChip } from "@/components/due-chip";
import { dueText, getMyAssignments } from "@/lib/assignments";

export const metadata = { title: "Dashboard" };

function greeting() {
  const h = hourIn(new Date());
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

export default async function DashboardPage(props: PageProps<"/">) {
  const user = await requireUser();
  const sp = await props.searchParams;
  const lvl = levelFromXp(user.xp);
  const firstName = user.name.split(" ")[0];
  const [catalog, assigned] = await Promise.all([listCatalog(user.id), getMyAssignments(user.id, user.department)]);
  const openAssigned = assigned.filter((a) => a.state !== "done");
  const assignedIds = new Set(openAssigned.map((a) => a.course.id));
  const overdue = openAssigned.filter((a) => a.state === "overdue");
  const upNext = [
    ...catalog.filter((c) => c.progress.status === "in_progress"),
    ...catalog.filter((c) => c.progress.status === "not_started" || c.progress.status === "failed"),
  ]
    .filter((c) => !assignedIds.has(c.id))
    .slice(0, 3);
  const completed = catalog.filter((c) => c.progress.status === "completed").length;
  const streak = liveStreak(user);
  const db = await getDb();
  const recentBadges = await db
    .select()
    .from(userBadges)
    .where(eq(userBadges.userId, user.id))
    .orderBy(desc(userBadges.awardedAt))
    .limit(6);

  return (
    <div className="space-y-8">
      {sp.denied && (
        <div className="rounded-2xl bg-danger/10 px-4 py-3 text-sm font-medium text-danger">
          You don&apos;t have permission to view that page.
        </div>
      )}

      <Card className="relative overflow-hidden p-8">
        <div className="absolute inset-0 bg-brand-gradient opacity-[0.92]" />
        <div className="absolute -right-10 -top-16 h-64 w-64 rounded-full bg-white/20 blur-3xl" />
        <div className="absolute -bottom-20 right-40 h-56 w-56 rounded-full bg-[var(--accent)]/40 blur-3xl" />
        <div className="relative flex flex-wrap items-center gap-6 text-white">
          <UserAvatar name={user.name} avatar={user.avatar} className="h-20 w-20 text-2xl ring-4 ring-white/30 animate-float" />
          <div className="min-w-0 flex-1">
            <p className="text-white/80">{greeting()},</p>
            <h1 className="font-display text-3xl font-bold md:text-4xl">{firstName} ✨</h1>
            <div className="mt-4 max-w-md">
              <div className="flex justify-between text-sm font-semibold">
                <span>
                  Level {lvl.level} · {lvl.title}
                </span>
                <span className="tabular-nums text-white/80">
                  {lvl.xpForNext - lvl.xpIntoLevel} XP to level {lvl.level + 1}
                </span>
              </div>
              <Progress value={lvl.progress} className="mt-2 h-3 bg-white/25" barClassName="bg-white" />
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Total XP" value={user.xp.toLocaleString()} icon={<Sparkles className="h-5 w-5" />} />
        <StatTile label="Level" value={lvl.level} icon={<Trophy className="h-5 w-5" />} hint={lvl.title} />
        <StatTile
          label="Streak"
          value={`${streak} ${streak === 1 ? "day" : "days"}`}
          icon={<Flame className="h-5 w-5 text-[var(--brand-3)]" />}
          hint={streak > 0 ? `Best: ${user.longestStreak} days` : "Finish a course today to start one"}
        />
        <StatTile label="Courses done" value={`${completed}/${catalog.length}`} icon={<BookCheck className="h-5 w-5" />} />
      </div>

      {overdue.length > 0 && (
        <div className="flex items-center gap-3 rounded-2xl border border-danger/30 bg-danger/10 px-5 py-4 text-danger">
          <AlarmClock className="h-5 w-5 shrink-0 animate-pulse" />
          <p className="text-sm font-semibold">
            {overdue.length === 1
              ? `“${overdue[0].course.title}” is overdue. Finish it soon to stay compliant.`
              : `You have ${overdue.length} overdue courses. Finish them soon to stay compliant.`}
          </p>
        </div>
      )}

      {openAssigned.length > 0 && (
        <section>
          <div className="mb-4 flex items-end justify-between">
            <h2 className="font-display text-xl font-bold">Assigned to you</h2>
            <span className="text-sm text-muted">
              {assigned.length - openAssigned.length}/{assigned.length} complete
            </span>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {openAssigned.map((a) => (
              <CourseCard
                key={a.course.id}
                course={a.course}
                dueLabel={<DueChip state={a.state} text={dueText(a.dueAt)} />}
              />
            ))}
          </div>
        </section>
      )}

      <section>
        <div className="mb-4 flex items-end justify-between">
          <h2 className="font-display text-xl font-bold">{openAssigned.length ? "More to explore" : "Up next"}</h2>
          <LinkButton href="/courses" variant="ghost" size="sm">
            All courses →
          </LinkButton>
        </div>
        {upNext.length === 0 ? (
          <Card className="p-8 text-center text-muted">
            {catalog.length === 0 ? "No courses published yet." : openAssigned.length ? "Nothing else waiting. Focus on your assigned training above." : "You're all caught up. Nice! 🎉"}
          </Card>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {upNext.map((c) => (
              <CourseCard key={c.id} course={c} />
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="mb-4 flex items-end justify-between">
          <h2 className="font-display text-xl font-bold">Badges</h2>
          <LinkButton href="/badges" variant="ghost" size="sm">
            All badges →
          </LinkButton>
        </div>
        <Card className="p-6">
          {recentBadges.length === 0 ? (
            <div className="flex flex-wrap items-center gap-4">
              {BADGES.slice(0, 5).map((b) => (
                <BadgeMedal key={b.key} badge={b} locked size="sm" />
              ))}
              <p className="text-sm text-muted">No badges yet. Pass your first course to earn one!</p>
            </div>
          ) : (
            <div className="flex flex-wrap gap-6">
              {recentBadges.map((r) => {
                const b = BADGE_BY_KEY.get(r.badge);
                if (!b) return null;
                return (
                  <Link key={r.badge} href="/badges" className="flex w-24 flex-col items-center text-center">
                    <BadgeMedal badge={b} />
                    <span className="mt-2 text-xs font-semibold">{b.name}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </Card>
      </section>
    </div>
  );
}
