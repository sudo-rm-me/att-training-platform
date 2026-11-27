import Link from "next/link";
import { and, count, desc, eq, ilike, or } from "drizzle-orm";
import { ChevronLeft, ChevronRight, History, Search } from "lucide-react";
import { getDb } from "@/db";
import { auditLog } from "@/db/schema";
import { requirePermission } from "@/lib/session";
import { AUDIT_ACTIONS } from "@/lib/audit";
import { Badge, Card, EmptyState, Input, PageHeader, buttonClass } from "@/components/ui";
import { cn } from "@/lib/utils";

export const metadata = { title: "Audit log" };

const PAGE = 50;

function when(d: Date) {
  return d.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: process.env.APP_TIMEZONE || "Europe/London",
  });
}

const tone = (action: string) =>
  action.endsWith("delete") || action.endsWith("archive")
    ? "danger"
    : action.startsWith("role")
      ? "accent"
      : action.endsWith("publish")
        ? "success"
        : "brand";

export default async function AuditPage(props: PageProps<"/admin/audit">) {
  await requirePermission("admin");
  const sp = await props.searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const action = typeof sp.action === "string" && sp.action in AUDIT_ACTIONS ? sp.action : "";
  const page = Math.max(1, Number(sp.page) || 1);

  const where = and(
    action ? eq(auditLog.action, action) : undefined,
    q ? or(ilike(auditLog.summary, `%${q}%`), ilike(auditLog.actorName, `%${q}%`)) : undefined,
  );
  const db = await getDb();
  const [rows, [{ total }]] = await Promise.all([
    db
      .select()
      .from(auditLog)
      .where(where)
      .orderBy(desc(auditLog.createdAt))
      .limit(PAGE)
      .offset((page - 1) * PAGE),
    db.select({ total: count() }).from(auditLog).where(where),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE));
  const href = (p: number) => `/admin/audit?${new URLSearchParams({ ...(q && { q }), ...(action && { action }), page: String(p) })}`;

  return (
    <div>
      <PageHeader
        eyebrow="Admin"
        title="Audit log"
        subtitle="A record of role changes, course publishing and assignments: who did what, and when."
      />
      <Card className="overflow-hidden">
        <form className="flex flex-wrap items-center gap-2 border-b border-border p-4">
          <Search className="h-4 w-4 text-muted" />
          <Input name="q" defaultValue={q} placeholder="Search people or details…" className="min-w-48 flex-1 border-0 bg-transparent focus:ring-0" />
          <select name="action" defaultValue={action} aria-label="Action" className="h-10 rounded-xl border border-border bg-card-solid px-3 text-sm">
            <option value="">All actions</option>
            {Object.entries(AUDIT_ACTIONS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <button className={buttonClass("secondary", "md")}>Filter</button>
        </form>
        {rows.length === 0 ? (
          <div className="p-6">
            <EmptyState icon={<History className="h-6 w-6" />} title="Nothing recorded yet" body="Changes made by admins, authors and managers appear here." />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wider text-muted">
                <tr>
                  <th className="px-5 py-3">When</th>
                  <th className="px-5 py-3">Who</th>
                  <th className="px-5 py-3">Action</th>
                  <th className="px-5 py-3">Details</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-border/70 align-top">
                    <td className="whitespace-nowrap px-5 py-3 text-muted tabular-nums">{when(r.createdAt)}</td>
                    <td className="whitespace-nowrap px-5 py-3 font-semibold">{r.actorName ?? "System"}</td>
                    <td className="whitespace-nowrap px-5 py-3">
                      <Badge tone={tone(r.action)}>{AUDIT_ACTIONS[r.action] ?? r.action}</Badge>
                    </td>
                    <td className="px-5 py-3">
                      {r.targetType === "course" && r.targetId ? (
                        <Link href={`/courses/${r.targetId}`} className="hover:text-brand hover:underline">
                          {r.summary}
                        </Link>
                      ) : (
                        r.summary
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {pages > 1 && (
          <div className="flex items-center justify-between border-t border-border px-5 py-3 text-sm">
            <span className="text-muted">
              Page {page} of {pages} · {total} entries
            </span>
            <div className="flex gap-2">
              <Link aria-disabled={page <= 1} href={href(page - 1)} className={cn(buttonClass("secondary", "sm"), page <= 1 && "pointer-events-none opacity-40")}>
                <ChevronLeft className="h-4 w-4" /> Newer
              </Link>
              <Link aria-disabled={page >= pages} href={href(page + 1)} className={cn(buttonClass("secondary", "sm"), page >= pages && "pointer-events-none opacity-40")}>
                Older <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
