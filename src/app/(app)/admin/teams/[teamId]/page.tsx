import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { ArrowLeft, Crown, Users } from "lucide-react";
import { getDb } from "@/db";
import { teamLeads, teams, users } from "@/db/schema";
import { requirePermission } from "@/lib/session";
import { listDepartments } from "@/lib/assignments";
import { levelFromXp } from "@/lib/levels";
import { Badge, Card, PageHeader } from "@/components/ui";
import { UserAvatar } from "@/components/user-avatar";
import { AddDepartment, AddLead, AddMembers, EditTeamForm, LeadToggle, RemoveMember } from "../team-client";

export async function generateMetadata(props: PageProps<"/admin/teams/[teamId]">) {
  const { teamId } = await props.params;
  if (!/^[0-9a-f-]{36}$/i.test(teamId)) return {};
  const db = await getDb();
  const [t] = await db.select({ name: teams.name }).from(teams).where(eq(teams.id, teamId));
  return { title: t?.name ?? "Team" };
}

export default async function TeamDetailPage(props: PageProps<"/admin/teams/[teamId]">) {
  await requirePermission("admin");
  const { teamId } = await props.params;
  if (!/^[0-9a-f-]{36}$/i.test(teamId)) notFound();
  const db = await getDb();
  const [team] = await db.select().from(teams).where(eq(teams.id, teamId));
  if (!team) notFound();

  const [everyone, leadRows, allTeams, departments] = await Promise.all([
    db.select().from(users).orderBy(asc(users.name)).limit(5000),
    db.select({ userId: teamLeads.userId }).from(teamLeads).where(eq(teamLeads.teamId, teamId)),
    db.select({ id: teams.id, name: teams.name }).from(teams),
    listDepartments(),
  ]);
  const leadIds = new Set(leadRows.map((l) => l.userId));
  const teamName = new Map(allTeams.map((t) => [t.id, t.name]));
  const members = everyone.filter((u) => u.teamId === teamId);
  const others = everyone.filter((u) => u.teamId !== teamId);
  const outsideLeads = everyone.filter((u) => leadIds.has(u.id) && u.teamId !== teamId);

  return (
    <div>
      <Link href="/admin/teams" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-fg">
        <ArrowLeft className="h-4 w-4" /> All teams
      </Link>
      <PageHeader
        eyebrow="Team"
        title={
          <span className="flex items-center gap-3">
            <span>{team.icon}</span> {team.name}
          </span>
        }
        subtitle={team.description || `${members.length} ${members.length === 1 ? "member" : "members"} · ${leadIds.size} ${leadIds.size === 1 ? "lead" : "leads"}`}
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <h2 className="flex items-center gap-2 font-display text-lg font-bold">
                <Users className="h-5 w-5 text-brand" /> Members
              </h2>
              <span className="text-sm text-muted">{members.length}</span>
            </div>
            {members.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-muted">No members yet. Add people on the right.</p>
            ) : (
              <ul>
                {members.map((u) => (
                  <li key={u.id} className="flex items-center gap-3 border-t border-border/60 px-5 py-3 first:border-t-0">
                    <UserAvatar name={u.name} avatar={u.avatar} className="h-9 w-9" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold">
                        {u.name} <Badge tone="muted" className="ml-1 capitalize">{u.role}</Badge>
                      </div>
                      <div className="truncate text-xs text-muted">
                        {u.email} · Level {levelFromXp(u.xp).level}
                        {u.department && ` · ${u.department}`}
                      </div>
                    </div>
                    <LeadToggle teamId={teamId} userId={u.id} name={u.name} lead={leadIds.has(u.id)} />
                    <RemoveMember userId={u.id} name={u.name} />
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="p-5">
            <h2 className="mb-1 flex items-center gap-2 font-display text-lg font-bold">
              <Crown className="h-5 w-5 text-accent" /> Leads from outside the team
            </h2>
            <p className="mb-4 text-sm text-muted">
              Leads manage this team&apos;s training. They don&apos;t have to be members. Learners made lead become managers.
            </p>
            {outsideLeads.length > 0 && (
              <ul className="mb-4 space-y-2">
                {outsideLeads.map((u) => (
                  <li key={u.id} className="flex items-center gap-3">
                    <UserAvatar name={u.name} avatar={u.avatar} className="h-8 w-8" />
                    <span className="flex-1 truncate text-sm font-semibold">{u.name}</span>
                    <LeadToggle teamId={teamId} userId={u.id} name={u.name} lead />
                  </li>
                ))}
              </ul>
            )}
            <AddLead
              teamId={teamId}
              people={others.filter((u) => !leadIds.has(u.id)).map((u) => ({ id: u.id, name: u.name, role: u.role }))}
            />
          </Card>
        </div>

        <div className="space-y-6 lg:sticky lg:top-24 lg:self-start">
          <Card className="p-6">
            <h2 className="mb-4 font-display text-lg font-bold">Add people</h2>
            <AddMembers
              teamId={teamId}
              people={others.map((u) => ({ id: u.id, name: u.name, email: u.email, team: u.teamId ? (teamName.get(u.teamId) ?? null) : null }))}
            />
            <div className="mt-4 border-t border-border pt-4">
              <AddDepartment teamId={teamId} departments={departments} />
              <p className="mt-1.5 text-xs text-muted">Adds people from that department who aren&apos;t in a team yet.</p>
            </div>
          </Card>
          <Card className="p-6">
            <h2 className="mb-4 font-display text-lg font-bold">Team details</h2>
            <EditTeamForm team={team} />
          </Card>
        </div>
      </div>
    </div>
  );
}
