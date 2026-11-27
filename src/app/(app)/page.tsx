import { Coins, Flame, Sparkles, Trophy } from "lucide-react";
import { requireUser } from "@/lib/session";
import { levelFromXp } from "@/lib/levels";
import { Card, LinkButton, Progress, StatTile } from "@/components/ui";
import { listCatalog } from "@/lib/courses";
import { CourseCard } from "@/components/course-card";
import { UserAvatar } from "@/components/user-avatar";

export const metadata = { title: "Dashboard" };

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

export default async function DashboardPage(props: PageProps<"/">) {
  const user = await requireUser();
  const sp = await props.searchParams;
  const lvl = levelFromXp(user.xp);
  const firstName = user.name.split(" ")[0];
  const catalog = await listCatalog(user.id);
  const upNext = [
    ...catalog.filter((c) => c.progress.status === "in_progress"),
    ...catalog.filter((c) => c.progress.status === "not_started" || c.progress.status === "failed"),
  ].slice(0, 3);
  const completed = catalog.filter((c) => c.progress.status === "completed").length;

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
        <StatTile label="Coins" value={user.coins.toLocaleString()} icon={<Coins className="h-5 w-5 text-accent" />} />
        <StatTile label="Level" value={lvl.level} icon={<Trophy className="h-5 w-5" />} hint={lvl.title} />
        <StatTile label="Courses done" value={`${completed}/${catalog.length}`} icon={<Flame className="h-5 w-5 text-[var(--brand-3)]" />} />
      </div>

      <section>
        <div className="mb-4 flex items-end justify-between">
          <h2 className="font-display text-xl font-bold">Up next</h2>
          <LinkButton href="/courses" variant="ghost" size="sm">
            All courses →
          </LinkButton>
        </div>
        {upNext.length === 0 ? (
          <Card className="p-8 text-center text-muted">
            {catalog.length === 0 ? "No courses published yet." : "You're all caught up. Nice! 🎉"}
          </Card>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {upNext.map((c) => (
              <CourseCard key={c.id} course={c} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
