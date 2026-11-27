import Link from "next/link";
import { count, eq, isNull } from "drizzle-orm";
import { Crown, UserX, Users } from "lucide-react";
import { getDb } from "@/db";
import { teamLeads, users } from "@/db/schema";
import { requirePermission } from "@/lib/session";
import { listTeams } from "@/lib/teams";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { UserAvatar } from "@/components/user-avatar";
import { FromDepartmentsButton, NewTeamForm } from "./team-client";

export const metadata = { title: "Teams" };

export default async function TeamsPage() {
  await requirePermission("admin");
  const db = await getDb();
  const list = await listTeams();
  const [leadRows, [{ unassigned }]] = await Promise.all([
    list.length
      ? db
          .select({ teamId: teamLeads.teamId, id: users.id, name: users.name, avatar: users.avatar })
          .from(teamLeads)
          .innerJoin(users, eq(users.id, teamLeads.userId))
      : Promise.resolve([]),
    db.select({ unassigned: count() }).from(users).where(isNull(users.teamId)),
  ]);
  const leadsByTeam = new Map<string, typeof leadRows>();
  for (const l of leadRows) leadsByTeam.set(l.teamId, [...(leadsByTeam.get(l.teamId) ?? []), l]);

  return (
    <div>
      <PageHeader
        eyebrow="Admin"
        title="Teams"
        subtitle="Group people into teams. Team leads see their team's progress and assign it training, and teams compete on the leaderboard."
        actions={<FromDepartmentsButton />}
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-4">
          {unassigned > 0 && (
            <Link
              href="/admin/users?team=none"
              className="flex items-center gap-3 rounded-2xl border border-dashed border-border px-5 py-4 text-sm transition hover:border-brand hover:text-brand"
            >
              <UserX className="h-5 w-5" />
              <span className="flex-1">
                <strong>{unassigned}</strong> {unassigned === 1 ? "person isn't" : "people aren't"} in a team yet
              </span>
              <span className="font-semibold">Review →</span>
            </Link>
          )}
          {list.length === 0 ? (
            <EmptyState
              icon={<Users className="h-6 w-6" />}
              title="No teams yet"
              body="Create your first team, or generate one per Entra department in one click."
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {list.map((t) => {
                const leads = leadsByTeam.get(t.id) ?? [];
                return (
                  <Link key={t.id} href={`/admin/teams/${t.id}`} className="group">
                    <Card className="h-full p-5 transition group-hover:-translate-y-0.5 group-hover:shadow-[0_20px_40px_-20px_var(--brand)]">
                      <div className="flex items-start gap-3">
                        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand/10 text-2xl">{t.icon}</span>
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-display text-lg font-bold">{t.name}</div>
                          <div className="text-sm text-muted">
                            {t.members} {t.members === 1 ? "member" : "members"}
                          </div>
                        </div>
                      </div>
                      {t.description && <p className="mt-3 line-clamp-2 text-sm text-muted">{t.description}</p>}
                      <div className="mt-4 flex items-center gap-2 text-xs text-muted">
                        <Crown className="h-3.5 w-3.5 text-accent" />
                        {leads.length === 0 ? (
                          <span>No lead yet</span>
                        ) : (
                          <>
                            <span className="flex -space-x-2">
                              {leads.slice(0, 4).map((l) => (
                                <UserAvatar key={l.id} name={l.name} avatar={l.avatar} className="h-6 w-6 ring-2 ring-card-solid" />
                              ))}
                            </span>
                            <span className="truncate">{leads.map((l) => l.name).join(", ")}</span>
                          </>
                        )}
                      </div>
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        <Card className="p-6 lg:sticky lg:top-24 lg:self-start">
          <h2 className="mb-5 font-display text-lg font-bold">New team</h2>
          <NewTeamForm />
        </Card>
      </div>
    </div>
  );
}
