import { asc, ilike, or } from "drizzle-orm";
import { Search } from "lucide-react";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { requirePermission } from "@/lib/session";
import { levelFromXp } from "@/lib/levels";
import { Badge, Card, Input, PageHeader } from "@/components/ui";
import { UserAvatar } from "@/components/user-avatar";
import { formatDate } from "@/lib/utils";
import { RoleSelect } from "./role-select";

export const metadata = { title: "People & roles" };

const ROLE_HELP = [
  ["Learner", "Takes courses, earns points."],
  ["Manager", "Sees their department's progress and assigns training."],
  ["Author", "Creates and publishes courses."],
  ["Admin", "Everything, including managing roles."],
];

export default async function UsersPage(props: PageProps<"/admin/users">) {
  const me = await requirePermission("admin");
  const sp = await props.searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const db = await getDb();
  const rows = await db
    .select()
    .from(users)
    .where(q ? or(ilike(users.name, `%${q}%`), ilike(users.email, `%${q}%`), ilike(users.department, `%${q}%`)) : undefined)
    .orderBy(asc(users.name))
    .limit(500);

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
        </form>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wider text-muted">
              <tr>
                <th className="px-5 py-3">Person</th>
                <th className="px-5 py-3">Department</th>
                <th className="px-5 py-3">Level</th>
                <th className="px-5 py-3">Last seen</th>
                <th className="px-5 py-3">Role</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.id} className="border-t border-border/70">
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
                  <td colSpan={5} className="px-5 py-10 text-center text-muted">
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
