import { and, asc, eq, ilike, isNull, or } from "drizzle-orm";
import { Search } from "lucide-react";
import { getDb } from "@/db";
import { teams, users } from "@/db/schema";
import { requirePermission } from "@/lib/session";
import { levelFromXp } from "@/lib/levels";
import { Badge, Card, Input, PageHeader } from "@/components/ui";
import { UserAvatar } from "@/components/user-avatar";
import { formatDate } from "@/lib/utils";
import { RoleSelect } from "./role-select";
import { TeamSelect } from "./team-select";

export const metadata = { title: "People & roles" };

const ROLE_HELP = [
  ["Learner", "Takes courses, earns points."],
  ["Manager", "Leads teams: sees their progress and assigns training."],
  ["Author", "Creates and publishes courses."],
  ["Admin", "Everything, including managing roles."],
];

export default async function UsersPage(props: PageProps<"/admin/users">) {
  const me = await requirePermission("admin");
  const sp = await props.searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const team = typeof sp.team === "string" ? sp.team : "";
  const db = await getDb();
  const [rows, teamList] = await Promise.all([
    db
      .select()
      .from(users)
      .where(
        and(
          q ? or(ilike(users.name, `%${q}%`), ilike(users.email, `%${q}%`), ilike(users.department, `%${q}%`)) : undefined,
          team === "none" ? isNull(users.teamId) : /^[0-9a-f-]{36}$/i.test(team) ? eq(users.teamId, team) : undefined,
        ),
      )
      .orderBy(asc(users.name))
      .limit(500),
    db.select({ id: teams.id, name: teams.name, icon: teams.icon }).from(teams).orderBy(asc(teams.name)),
  ]);

  return (
    <div>
      <PageHeader
        eyebrow="Admin"
        title="People & roles"
        subtitle="Everyone who has signed in appears here. Give people extra permissions by changing their role."
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {ROLE_HELP.map(([r, d]) => (
          <Card key={r} className="p-4">
            <div className="font-semibold">{r}</div>
            <div className="text-sm text-muted">{d}</div>
          </Card>
        ))}
      </div>

      <Card className="overflow-hidden">
        <form className="flex items-center gap-2 border-b border-border p-4">
          <Search className="h-4 w-4 text-muted" />
          <Input name="q" defaultValue={q} placeholder="Search by name, email or department…" className="border-0 bg-transparent focus:ring-0" />
          <select name="team" defaultValue={team} aria-label="Filter by team" className="h-10 rounded-xl border border-border bg-card-solid px-3 text-sm">
            <option value="">All teams</option>
            <option value="none">Not in a team</option>
            {teamList.map((t) => (
              <option key={t.id} value={t.id}>
                {t.icon} {t.name}
              </option>
            ))}
          </select>
          <button className="h-10 rounded-xl px-3 text-sm font-semibold text-brand">Filter</button>
        </form>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wider text-muted">
              <tr>
                <th className="px-5 py-3">Person</th>
                <th className="px-5 py-3">Team</th>
                <th className="px-5 py-3">Department</th>
                <th className="px-5 py-3">Level</th>
                <th className="px-5 py-3">Last seen</th>
                <th className="px-5 py-3">Role</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.id} data-user-id={u.id} className="border-t border-border/70">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <UserAvatar name={u.name} avatar={u.avatar} className="h-9 w-9" />
                      <div>
                        <div className="font-semibold">
                          {u.name} {u.id === me.id && <Badge tone="muted">You</Badge>}
                        </div>
                        <div className="text-xs text-muted">{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <TeamSelect userId={u.id} teamId={u.teamId} teams={teamList} />
                  </td>
                  <td className="px-5 py-3 text-muted">{u.department ?? "—"}</td>
                  <td className="px-5 py-3 tabular-nums">{levelFromXp(u.xp).level}</td>
                  <td className="px-5 py-3 text-muted">{formatDate(u.lastSeenAt)}</td>
                  <td className="px-5 py-3">
                    <RoleSelect userId={u.id} role={u.role} />
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-muted">
                    No one matches that search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
