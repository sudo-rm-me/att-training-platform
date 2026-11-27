import Link from "next/link";
import { and, count, desc, eq, gte, isNotNull, sql } from "drizzle-orm";
import { Crown, Flame, Users } from "lucide-react";
import { getDb } from "@/db";
import { teams as teamsTable, users, xpEvents, type AvatarConfig } from "@/db/schema";
import { requireUser } from "@/lib/session";
import { levelFromXp } from "@/lib/levels";
import { liveStreak } from "@/lib/gamification";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { UserAvatar } from "@/components/user-avatar";
import { cn } from "@/lib/utils";

export const metadata = { title: "Leaderboard" };

const PERIODS = [
  { key: "week", label: "Last 7 days", days: 7 },
  { key: "month", label: "Last 30 days", days: 30 },
  { key: "all", label: "All time", days: null },
] as const;

function daysAgo(days: number) {
  return new Date(Date.now() - days * 86400_000);
}

type Row = {
  id: string;
  name: string;
  department: string | null;
  teamId: string | null;
  avatar: AvatarConfig | null;
  xp: number;
  totalXp: number;
  streak: number;
  rank: number;
};

export default async function LeaderboardPage(props: PageProps<"/leaderboard">) {
  const me = await requireUser();
  const sp = await props.searchParams;
  const period = PERIODS.find((p) => p.key === sp.period) ?? PERIODS[0];
  const view = sp.view === "teams" ? "teams" : "people";
  const db = await getDb();
  const since = period.days ? daysAgo(period.days) : null;

  const href = (patch: Record<string, string>) =>
    `/leaderboard?${new URLSearchParams({ period: period.key, view, ...patch })}`;

  let people: Row[] = [];
  let teams: { key: string; label: string; members: number; xp: number; avg: number; rank: number }[] = [];
  const allTeams = await db.select().from(teamsTable);
  const useTeams = allTeams.length > 0;
  const teamLabel = new Map(allTeams.map((t) => [t.id, `${t.icon} ${t.name}`]));
  const myGroup = useTeams ? me.teamId : me.department;

  if (view === "people") {
    const raw = since
      ? await db
          .select({
            id: users.id,
            name: users.name,
            department: users.department,
            teamId: users.teamId,
            avatar: users.avatar,
            totalXp: users.xp,
            currentStreak: users.currentStreak,
            lastActiveDay: users.lastActiveDay,
            xp: sql<number>`sum(${xpEvents.xp})`.mapWith(Number),
          })
          .from(xpEvents)
          .innerJoin(users, eq(users.id, xpEvents.userId))
          .where(gte(xpEvents.createdAt, since))
          .groupBy(users.id)
          .having(sql`sum(${xpEvents.xp}) > 0`)
          .orderBy(desc(sql`sum(${xpEvents.xp})`))
      : await db
          .select({
            id: users.id,
            name: users.name,
            department: users.department,
            teamId: users.teamId,
            avatar: users.avatar,
            totalXp: users.xp,
            currentStreak: users.currentStreak,
            lastActiveDay: users.lastActiveDay,
            xp: users.xp,
          })
          .from(users)
          .where(sql`${users.xp} > 0`)
          .orderBy(desc(users.xp));
    let rank = 0;
    let prev = Number.NaN;
    people = raw.map((r, i) => {
      if (r.xp !== prev) rank = i + 1;
      prev = r.xp;
      return { ...r, streak: liveStreak(r), rank };
    });
  } else {
    // Rank admin-managed teams when there are any; otherwise Entra departments.
    const groupCol = useTeams ? users.teamId : users.department;
    const members = await db
      .select({ key: groupCol, n: count() })
      .from(users)
      .where(isNotNull(groupCol))
      .groupBy(groupCol);
    const totals = await db
      .select({ key: groupCol, xp: sql<number>`coalesce(sum(${xpEvents.xp}), 0)`.mapWith(Number) })
      .from(xpEvents)
      .innerJoin(users, eq(users.id, xpEvents.userId))
      .where(since ? and(isNotNull(groupCol), gte(xpEvents.createdAt, since)) : isNotNull(groupCol))
      .groupBy(groupCol);
    const t = new Map(totals.map((r) => [r.key, r.xp]));
    teams = members
      .map((m) => {
        const xp = t.get(m.key) ?? 0;
        const label = useTeams ? (teamLabel.get(m.key!) ?? "") : m.key!;
        return { key: m.key!, label, members: m.n, xp, avg: Math.round(xp / Math.max(1, m.n)), rank: 0 };
      })
      .filter((x) => x.label.trim())
      .sort((a, b) => b.avg - a.avg || b.xp - a.xp);
    teams.forEach((x, i) => (x.rank = i + 1));
  }

  const myRow = people.find((p) => p.id === me.id);
  const top = people.slice(0, 50);
  const podium = top.slice(0, 3);

  return (
    <div>
      <PageHeader eyebrow="Compete" title="Leaderboard" subtitle="Earn XP by completing courses, keeping streaks alive and unlocking badges." />

      <div className="mb-8 flex flex-wrap items-center gap-3">
        <div className="glass flex gap-1 rounded-2xl p-1">
          {(["people", "teams"] as const).map((v) => (
            <Link
              key={v}
              href={href({ view: v })}
              className={cn(
                "flex items-center gap-1.5 rounded-xl px-4 py-1.5 text-sm font-semibold capitalize transition",
                view === v ? "bg-brand-gradient text-white" : "text-muted hover:text-fg",
              )}
            >
              {v === "people" ? <Crown className="h-4 w-4" /> : <Users className="h-4 w-4" />}
              {v === "people" ? "Individuals" : "Teams"}
            </Link>
          ))}
        </div>
        <div className="glass flex gap-1 rounded-2xl p-1">
          {PERIODS.map((p) => (
            <Link
              key={p.key}
              href={href({ period: p.key })}
              className={cn(
                "rounded-xl px-3.5 py-1.5 text-sm font-semibold transition",
                period.key === p.key ? "bg-fg text-bg" : "text-muted hover:text-fg",
              )}
            >
              {p.label}
            </Link>
          ))}
        </div>
      </div>

      {view === "people" ? (
        people.length === 0 ? (
          <EmptyState icon={<Crown className="h-6 w-6" />} title="No XP earned yet" body="Complete a course to claim the top spot!" />
        ) : (
          <>
            <div className="mb-8 grid grid-cols-3 items-end gap-3 md:gap-6">
              {[podium[1], podium[0], podium[2]].map((p, i) => {
                if (!p) return <div key={i} />;
                const place = p.rank;
                const height = place === 1 ? "h-40 md:h-48" : place === 2 ? "h-32 md:h-36" : "h-24 md:h-28";
                const medal = place === 1 ? "🥇" : place === 2 ? "🥈" : "🥉";
                return (
                  <div key={p.id} className="flex flex-col items-center">
                    <div className="relative">
                      {place === 1 && <Crown className="absolute -top-7 left-1/2 h-7 w-7 -translate-x-1/2 text-accent drop-shadow" />}
                      <UserAvatar
                        name={p.name}
                        avatar={p.avatar}
                        className={cn("ring-4 ring-white/70 shadow-xl", place === 1 ? "h-24 w-24 md:h-28 md:w-28" : "h-16 w-16 md:h-20 md:w-20")}
                      />
                    </div>
                    <div className="mt-2 max-w-full truncate text-center font-bold">{p.name}</div>
                    <div className="text-xs text-muted">{(p.teamId && teamLabel.get(p.teamId)) || p.department || ""}</div>
                    <div
                      className={cn(
                        "mt-3 flex w-full flex-col items-center justify-start rounded-t-3xl pt-3 text-white shadow-xl",
                        height,
                        place === 1 ? "bg-brand-gradient" : place === 2 ? "bg-[linear-gradient(160deg,#94a3b8,#475569)]" : "bg-[linear-gradient(160deg,#fdba74,#c2410c)]",
                      )}
                    >
                      <span className="text-3xl">{medal}</span>
                      <span className="font-display text-xl font-extrabold tabular-nums">{p.xp.toLocaleString()}</span>
                      <span className="text-xs opacity-80">XP</span>
                    </div>
                  </div>
                );
              })}
            </div>

            <Card className="overflow-hidden">
              <ol>
                {top.map((p) => (
                  <li
                    key={p.id}
                    className={cn("flex items-center gap-4 border-t border-border/60 px-5 py-3 first:border-t-0", p.id === me.id && "bg-brand/8")}
                  >
                    <span className="w-8 text-center font-display text-lg font-bold text-muted tabular-nums">{p.rank}</span>
                    <UserAvatar name={p.name} avatar={p.avatar} className="h-10 w-10" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold">
                        {p.name} {p.id === me.id && <span className="text-xs font-bold text-brand">(you)</span>}
                      </div>
                      <div className="text-xs text-muted">
                        Level {levelFromXp(p.totalXp).level} · {levelFromXp(p.totalXp).title}
                        {((p.teamId && teamLabel.get(p.teamId)) || p.department) && ` · ${(p.teamId && teamLabel.get(p.teamId)) || p.department}`}
                      </div>
                    </div>
                    {p.streak > 1 && (
                      <span className="hidden items-center gap-1 text-sm font-semibold text-[var(--brand-3)] sm:flex" title="Current streak">
                        <Flame className="h-4 w-4" /> {p.streak}
                      </span>
                    )}
                    <span className="w-24 text-right font-display font-bold tabular-nums">{p.xp.toLocaleString()} XP</span>
                  </li>
                ))}
              </ol>
              {myRow && myRow.rank > 50 && (
                <div className="flex items-center gap-4 border-t-2 border-dashed border-border bg-brand/8 px-5 py-3">
                  <span className="w-8 text-center font-display text-lg font-bold tabular-nums">{myRow.rank}</span>
                  <UserAvatar name={myRow.name} avatar={myRow.avatar} />
                  <div className="flex-1 font-semibold">You</div>
                  <span className="font-display font-bold tabular-nums">{myRow.xp.toLocaleString()} XP</span>
                </div>
              )}
            </Card>
            {!myRow && <p className="mt-4 text-center text-sm text-muted">You haven&apos;t earned XP in this period yet. Go get on the board!</p>}
          </>
        )
      ) : teams.length === 0 ? (
        <EmptyState icon={<Users className="h-6 w-6" />} title="No teams yet" body="Admins can set up teams under Admin → Teams. Until then, rankings use departments from Microsoft profiles." />
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted">Teams are ranked by average XP per member, so smaller teams can compete with bigger ones.</p>
          {teams.map((t) => {
            const best = teams[0].avg || 1;
            const mine = t.key === myGroup;
            return (
              <Card key={t.key} className={cn("flex items-center gap-4 p-4", mine && "ring-2 ring-brand")}>
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand-gradient font-display text-lg font-bold text-white">
                  {t.rank <= 3 ? ["🥇", "🥈", "🥉"][t.rank - 1] : t.rank}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate font-semibold">
                      {t.label} {mine && <span className="text-xs font-bold text-brand">(your team)</span>}
                    </span>
                    <span className="font-display font-bold tabular-nums">{t.avg.toLocaleString()} XP / person</span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-fg/8">
                    <div className="h-full rounded-full bg-brand-gradient" style={{ width: `${(t.avg / best) * 100}%` }} />
                  </div>
                  <div className="mt-1 text-xs text-muted">
                    {t.members} {t.members === 1 ? "member" : "members"} · {t.xp.toLocaleString()} XP total
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
