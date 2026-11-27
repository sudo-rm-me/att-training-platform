import { asc, inArray } from "drizzle-orm";
import { AlarmClock, Award, ChevronDown, ClipboardCheck, Sparkles, Users } from "lucide-react";
import { getDb } from "@/db";
import { courses } from "@/db/schema";
import { requirePermission } from "@/lib/session";
import { dueState, dueText, listDepartments, managedPeople, mergeForUser, passedPairs, publishedAssignments, type DueState } from "@/lib/assignments";
import { listTeams, scopeFor, teamsByIds } from "@/lib/teams";
import { levelFromXp } from "@/lib/levels";
import { liveStreak } from "@/lib/gamification";
import { Card, EmptyState, LinkButton, PageHeader, Progress, StatTile } from "@/components/ui";
import { DueChip } from "@/components/due-chip";
import { UserAvatar } from "@/components/user-avatar";
import { cn, formatDate } from "@/lib/utils";

export const metadata = { title: "Team progress" };

export default async function TeamPage(props: PageProps<"/team">) {
  const me = await requirePermission("manage");
  const isAdmin = me.role === "admin";
  const sp = await props.searchParams;
  const scope = await scopeFor(me);
  const group = typeof sp.group === "string" ? sp.group : "";
  const teamParam = group.startsWith("team:") ? group.slice(5) : null;
  const deptParam = isAdmin && group.startsWith("dept:") ? group.slice(5) : null;

  const [teamOptions, departments] = await Promise.all([
    isAdmin ? listTeams() : teamsByIds(scope.leadTeamIds),
    isAdmin ? listDepartments() : Promise.resolve([]),
  ]);
  const selectedTeam = teamOptions.find((t) => t.id === teamParam) ?? null;
  const [people, all] = await Promise.all([
    managedPeople(scope, { teamId: selectedTeam?.id ?? null, department: deptParam }),
    publishedAssignments(),
  ]);
  const passed = await passedPairs(people.map((p) => p.id));
  const courseIds = [...new Set(all.map((a) => a.courseId))];
  const db = await getDb();
  const courseInfo = new Map(
    courseIds.length
      ? (
          await db
            .select({ id: courses.id, title: courses.title, icon: courses.icon })
            .from(courses)
            .where(inArray(courses.id, courseIds))
            .orderBy(asc(courses.title))
        ).map((c) => [c.id, c])
      : [],
  );
  const now = new Date();

  type Item = { courseId: string; title: string; icon: string; state: DueState; dueAt: Date | null };
  const rows = people.map((p) => {
    const items: Item[] = [...mergeForUser(all, p)].map(([courseId, m]) => ({
      courseId,
      title: courseInfo.get(courseId)?.title ?? "Course",
      icon: courseInfo.get(courseId)?.icon ?? "📘",
      dueAt: m.dueAt,
      state: dueState(m.dueAt, passed.has(`${p.id}:${courseId}`), now),
    }));
    const done = items.filter((i) => i.state === "done").length;
    const overdue = items.filter((i) => i.state === "overdue").length;
    return { p, items, done, overdue, lvl: levelFromXp(p.xp), streak: liveStreak(p) };
  });
  rows.sort((a, b) => b.overdue - a.overdue || a.done / (a.items.length || 1) - b.done / (b.items.length || 1) || a.p.name.localeCompare(b.p.name));

  const totalAssigned = rows.reduce((n, r) => n + r.items.length, 0);
  const totalDone = rows.reduce((n, r) => n + r.done, 0);
  const totalOverdue = rows.reduce((n, r) => n + r.overdue, 0);
  const avgXp = people.length ? Math.round(people.reduce((n, p) => n + p.xp, 0) / people.length) : 0;

  // Per-course rollup
  const byCourse = new Map<string, { title: string; icon: string; assigned: number; done: number; overdue: number }>();
  for (const r of rows)
    for (const i of r.items) {
      const c = byCourse.get(i.courseId) ?? { title: i.title, icon: i.icon, assigned: 0, done: 0, overdue: 0 };
      c.assigned++;
      if (i.state === "done") c.done++;
      if (i.state === "overdue") c.overdue++;
      byCourse.set(i.courseId, c);
    }

  const scopeLabel = selectedTeam
    ? selectedTeam.name
    : deptParam
      ? deptParam
      : isAdmin
        ? "everyone"
        : scope.leadTeamIds.length
          ? teamOptions.length === 1
            ? teamOptions[0].name
            : "your teams"
          : (me.department ?? "your team");
  const showPicker = teamOptions.length + departments.length > (isAdmin ? 0 : 1);

  return (
    <div>
      <PageHeader
        eyebrow="Manage"
        title="Team progress"
        subtitle={`How ${scopeLabel} ${scopeLabel === "your teams" ? "are" : "is"} getting on with assigned training.`}
        actions={
          <>
            {showPicker && (
              <form className="glass flex items-center gap-2 rounded-xl px-3">
                <Users className="h-4 w-4 text-muted" />
                <select
                  name="group"
                  defaultValue={group}
                  className="h-10 max-w-56 bg-transparent text-sm font-semibold outline-none"
                  aria-label="Team or department"
                >
                  <option value="">{isAdmin ? "Everyone" : "All my teams"}</option>
                  {teamOptions.length > 0 && (
                    <optgroup label="Teams">
                      {teamOptions.map((t) => (
                        <option key={t.id} value={`team:${t.id}`}>
                          {t.icon} {t.name}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {departments.length > 0 && (
                    <optgroup label="Departments (from Entra)">
                      {departments.map((d) => (
                        <option key={d} value={`dept:${d}`}>
                          {d}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
                <button className="text-sm font-semibold text-brand">Go</button>
              </form>
            )}
            <LinkButton href="/assignments">
              <ClipboardCheck className="h-4 w-4" /> Assign training
            </LinkButton>
          </>
        }
      />

      {people.length === 0 ? (
        <EmptyState
          icon={<Users className="h-6 w-6" />}
          title="Nobody here yet"
          body={
            isAdmin
              ? "Nobody matches this team or department yet. Add people on the Teams page."
              : "You don't lead a team yet, or it has no members. Ask an admin to set up your team."
          }
        />
      ) : (
        <div className="space-y-8">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatTile label="People" value={people.length} icon={<Users className="h-5 w-5" />} />
            <StatTile
              label="Completion"
              value={totalAssigned ? `${Math.round((totalDone / totalAssigned) * 100)}%` : "—"}
              icon={<ClipboardCheck className="h-5 w-5" />}
              hint={`${totalDone} of ${totalAssigned} assigned courses done`}
            />
            <StatTile
              label="Overdue"
              value={totalOverdue}
              icon={<AlarmClock className={cn("h-5 w-5", totalOverdue && "text-danger")} />}
              hint={totalOverdue ? "Needs a nudge" : "Nothing overdue 🎉"}
            />
            <StatTile label="Average XP" value={avgXp.toLocaleString()} icon={<Sparkles className="h-5 w-5" />} />
          </div>

          {byCourse.size > 0 && (
            <section>
              <h2 className="mb-4 font-display text-xl font-bold">By course</h2>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {[...byCourse.entries()].map(([id, c]) => (
                  <Card key={id} className="p-5">
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">{c.icon}</span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-semibold">{c.title}</div>
                        <div className="text-xs text-muted">
                          {c.done}/{c.assigned} complete{c.overdue > 0 && <span className="font-semibold text-danger"> · {c.overdue} overdue</span>}
                        </div>
                      </div>
                      <span className="font-display text-xl font-bold tabular-nums">{Math.round((c.done / c.assigned) * 100)}%</span>
                    </div>
                    <Progress value={c.done / c.assigned} className="mt-3" barClassName={c.done === c.assigned ? "bg-success bg-none" : undefined} />
                  </Card>
                ))}
              </div>
            </section>
          )}

          <section>
            <h2 className="mb-4 font-display text-xl font-bold">People</h2>
            <Card className="overflow-hidden">
              {rows.map(({ p, items, done, overdue, lvl, streak }) => (
                <details key={p.id} className="group border-t border-border/60 first:border-t-0">
                  <summary className="flex cursor-pointer list-none flex-wrap items-center gap-4 px-5 py-3.5 hover:bg-fg/[0.03] [&::-webkit-details-marker]:hidden">
                    <UserAvatar name={p.name} avatar={p.avatar} className="h-10 w-10" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold">{p.name}</div>
                      <div className="truncate text-xs text-muted">
                        {p.jobTitle ?? p.email} · Level {lvl.level} · {p.xp.toLocaleString()} XP
                        {streak > 1 && ` · 🔥 ${streak}`}
                      </div>
                    </div>
                    {overdue > 0 && <DueChip state="overdue" text={`${overdue} overdue`} />}
                    <div className="w-36">
                      <div className="flex justify-between text-xs font-semibold">
                        <span>Assigned</span>
                        <span className="tabular-nums text-muted">
                          {done}/{items.length}
                        </span>
                      </div>
                      <Progress
                        value={items.length ? done / items.length : 0}
                        className="mt-1.5 h-1.5"
                        barClassName={items.length > 0 && done === items.length ? "bg-success bg-none" : undefined}
                      />
                    </div>
                    <span className="hidden w-28 text-right text-xs text-muted md:block">Seen {formatDate(p.lastSeenAt)}</span>
                    <ChevronDown className="h-4 w-4 text-muted transition group-open:rotate-180" />
                  </summary>
                  <div className="bg-fg/[0.02] px-5 pb-4 pt-1 md:pl-[4.75rem]">
                    {items.length === 0 ? (
                      <p className="py-2 text-sm text-muted">No training assigned.</p>
                    ) : (
                      <ul className="divide-y divide-border/60">
                        {items.map((i) => (
                          <li key={i.courseId} className="flex flex-wrap items-center gap-3 py-2 text-sm">
                            <span className="text-lg">{i.icon}</span>
                            <span className="min-w-0 flex-1 truncate font-medium">{i.title}</span>
                            <DueChip state={i.state} text={i.state === "done" ? "Completed" : dueText(i.dueAt, now)} />
                            {i.state === "done" && (
                              <a
                                href={`/api/certificates/${i.courseId}?user=${p.id}`}
                                target="_blank"
                                rel="noopener"
                                className="flex items-center gap-1 text-xs font-semibold text-brand hover:underline"
                              >
                                <Award className="h-3.5 w-3.5" /> Certificate
                              </a>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </details>
              ))}
            </Card>
          </section>
        </div>
      )}
    </div>
  );
}
