import { asc, desc, eq, inArray } from "drizzle-orm";
import { Building2, ClipboardList, Globe2, User as UserIcon, Users } from "lucide-react";
import { getDb } from "@/db";
import { assignments, courses, users } from "@/db/schema";
import { requirePermission } from "@/lib/session";
import { appliesTo, canTarget, dueState, dueText, isCompliant, latestPasses, listDepartments, managedPeople, requirementStatus } from "@/lib/assignments";
import { listTeams, scopeFor, teamsByIds } from "@/lib/teams";
import { dayKey } from "@/lib/gamification";
import { Card, EmptyState, PageHeader, Progress } from "@/components/ui";
import { DueChip } from "@/components/due-chip";
import { formatDate } from "@/lib/utils";
import { AssignForm } from "./assign-form";
import { DeleteAssignmentButton } from "./delete-button";

export const metadata = { title: "Assignments" };

export default async function AssignmentsPage() {
  const me = await requirePermission("manage");
  const isAdmin = me.role === "admin";
  const scope = await scopeFor(me);
  const db = await getDb();

  const [published, people, departments, myTeams, allTeams] = await Promise.all([
    db
      .select({ id: courses.id, title: courses.title, icon: courses.icon })
      .from(courses)
      .where(eq(courses.status, "published"))
      .orderBy(asc(courses.title)),
    managedPeople(scope),
    isAdmin
      ? listDepartments()
      : Promise.resolve(scope.leadTeamIds.length === 0 && me.department?.trim() ? [me.department.trim()] : []),
    isAdmin ? listTeams() : teamsByIds(scope.leadTeamIds),
    listTeams(),
  ]);
  const teamName = new Map(allTeams.map((t) => [t.id, `${t.icon} ${t.name}`]));

  const rows = await db
    .select({ a: assignments, courseTitle: courses.title, courseIcon: courses.icon, courseStatus: courses.status })
    .from(assignments)
    .innerJoin(courses, eq(courses.id, assignments.courseId))
    .orderBy(desc(assignments.createdAt));

  // Names for target users and assigners
  const nameIds = [...new Set(rows.flatMap((r) => [r.a.targetUserId, r.a.assignedBy]).filter((x): x is string => !!x))];
  const names = new Map(
    nameIds.length
      ? (await db.select({ id: users.id, name: users.name, department: users.department }).from(users).where(inArray(users.id, nameIds))).map(
          (u) => [u.id, u],
        )
      : [],
  );

  // Only show assignments that touch people this person manages.
  const peopleIds = new Set(people.map((p) => p.id));
  const visible = rows.filter(({ a }) => {
    if (isAdmin) return true;
    if (a.assignedBy === me.id) return true;
    if (a.targetType === "user") return peopleIds.has(a.targetUserId!);
    return people.some((p) => appliesTo(a, p));
  });

  const passes = await latestPasses(people.map((p) => p.id));
  const now = new Date();

  const noTeam = !isAdmin && people.length === 0;

  return (
    <div>
      <PageHeader
        eyebrow="Manage"
        title="Assignments"
        subtitle={
          isAdmin
            ? "Assign required training to people, departments or the whole organisation, with optional due dates."
            : scope.leadTeamIds.length
              ? "Assign required training to the teams you lead."
              : `Assign required training to people in ${me.department ?? "your department"}.`
        }
      />

      {noTeam ? (
        <EmptyState
          icon={<Building2 className="h-6 w-6" />}
          title="No team found"
          body="You don't lead a team yet and your profile has no department, so there's nobody to assign training to. Ask an admin to make you a team lead."
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,360px)_1fr]">
          <Card className="p-6 lg:sticky lg:top-24 lg:self-start">
            <h2 className="mb-5 font-display text-lg font-bold">New assignment</h2>
            {published.length === 0 ? (
              <p className="text-sm text-muted">Publish a course first, then you can assign it here.</p>
            ) : (
              <AssignForm
                courses={published}
                people={people.map((p) => ({ id: p.id, name: p.name, department: p.department }))}
                departments={departments}
                teams={myTeams.map((t) => ({ id: t.id, name: t.name, icon: t.icon }))}
                allowEveryone={isAdmin}
                today={dayKey(now)}
              />
            )}
          </Card>

          <div className="space-y-3">
            {visible.length === 0 ? (
              <EmptyState
                icon={<ClipboardList className="h-6 w-6" />}
                title="Nothing assigned yet"
                body="Assigned courses show up on people's dashboards, with reminders as the due date gets close."
              />
            ) : (
              visible.map(({ a, courseTitle, courseIcon, courseStatus }) => {
                const targets = people.filter((p) => appliesTo(a, p));
                const done = targets.filter((p) => isCompliant(requirementStatus(a, passes.get(`${p.id}:${a.courseId}`) ?? null, now).state)).length;
                const allDone = targets.length > 0 && done === targets.length;
                const state = dueState(a.dueAt, allDone, now);
                const targetUser = a.targetUserId ? names.get(a.targetUserId) : null;
                const editable = canTarget(scope, a, targetUser ? people.find((p) => p.id === a.targetUserId) ?? null : null);
                return (
                  <Card key={a.id} className="flex flex-wrap items-center gap-4 p-4">
                    <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand/10 text-2xl">{courseIcon}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate font-semibold">{courseTitle}</span>
                        {courseStatus !== "published" && <span className="text-xs font-semibold text-muted">({courseStatus})</span>}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                        <span className="flex items-center gap-1 font-semibold text-fg">
                          {a.targetType === "everyone" ? (
                            <>
                              <Globe2 className="h-3.5 w-3.5" /> Everyone
                            </>
                          ) : a.targetType === "team" ? (
                            <>
                              <Users className="h-3.5 w-3.5" /> {teamName.get(a.targetTeamId!) ?? "Deleted team"}
                            </>
                          ) : a.targetType === "department" ? (
                            <>
                              <Building2 className="h-3.5 w-3.5" /> {a.targetDepartment}
                            </>
                          ) : (
                            <>
                              <UserIcon className="h-3.5 w-3.5" /> {targetUser?.name ?? "Removed user"}
                            </>
                          )}
                        </span>
                        <DueChip state={state} text={allDone ? "All done" : dueText(a.dueAt, now)} />
                        <span>
                          by {a.assignedBy ? (names.get(a.assignedBy)?.name ?? "someone") : "someone"} · {formatDate(a.createdAt)}
                        </span>
                      </div>
                      {a.recurMonths && (
                        <p className="mt-1 text-xs font-semibold text-muted">
                          ↻ Repeats every {a.recurMonths % 12 === 0 ? `${a.recurMonths / 12 === 1 ? "year" : `${a.recurMonths / 12} years`}` : `${a.recurMonths} months`}
                        </p>
                      )}
                      {a.note && <p className="mt-1.5 text-sm text-muted">“{a.note}”</p>}
                    </div>
                    <div className="w-40">
                      <div className="flex justify-between text-xs font-semibold">
                        <span>{isAdmin ? "Completed" : "Your team"}</span>
                        <span className="tabular-nums text-muted">
                          {done}/{targets.length}
                        </span>
                      </div>
                      <Progress value={targets.length ? done / targets.length : 0} className="mt-1.5" />
                    </div>
                    {editable && <DeleteAssignmentButton id={a.id} title={courseTitle} />}
                  </Card>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
