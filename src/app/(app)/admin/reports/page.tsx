import Link from "next/link";
import { Activity, BookCheck, ShieldCheck, Star, Target, Users } from "lucide-react";
import { requirePermission } from "@/lib/session";
import { reportData } from "@/lib/reports";
import { Card, EmptyState, PageHeader, StatTile } from "@/components/ui";
import { ColumnChart, PercentBars } from "@/components/charts";

export const metadata = { title: "Reports" };

export default async function ReportsPage() {
  await requirePermission("admin");
  const r = await reportData();
  const t = r.tiles;

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Admin" title="Reports" subtitle="How training is going across the organisation. Figures are live." />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatTile label="People" value={t.people.toLocaleString()} icon={<Users className="h-5 w-5" />} />
        <StatTile label="Active learners" value={t.activeLearners.toLocaleString()} icon={<Activity className="h-5 w-5" />} hint="Started a course in the last 30 days" />
        <StatTile label="Courses passed" value={t.completions30.toLocaleString()} icon={<BookCheck className="h-5 w-5" />} hint={`Last 30 days, from ${t.attempts30} finished attempts`} />
        <StatTile label="Average score" value={t.avgScore30 == null ? "–" : `${t.avgScore30}%`} icon={<Target className="h-5 w-5" />} hint="Finished attempts, last 30 days" />
        <StatTile
          label="Compliance"
          value={t.compliancePct == null ? "–" : `${t.compliancePct}%`}
          icon={<ShieldCheck className="h-5 w-5" />}
          hint={t.required ? `Of ${t.required.toLocaleString()} assigned requirements` : "No assigned training yet"}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card className="p-6">
          <h2 className="font-display text-lg font-bold">Courses passed per week</h2>
          <p className="text-sm text-muted">Last 12 weeks</p>
          <div className="mt-2">
            <ColumnChart
              label="Courses passed per week"
              unit="Passed"
              data={r.weekly.map((w) => ({
                key: w.week,
                label: w.label,
                value: w.passed,
                detail: `${w.attempts} finished attempt${w.attempts === 1 ? "" : "s"}`,
              }))}
            />
          </div>
        </Card>
        <Card className="p-6">
          <h2 className="font-display text-lg font-bold">Compliance by {r.groupBy}</h2>
          <p className="mb-4 text-sm text-muted">Share of assigned training that is complete and in date, lowest first</p>
          {r.compliance.length ? (
            <PercentBars
              rows={r.compliance.map((g) => ({
                key: g.key || "none",
                label: g.label,
                pct: g.pct,
                detail: `${g.done}/${g.required} · ${g.people} ${g.people === 1 ? "person" : "people"}`,
              }))}
            />
          ) : (
            <p className="text-sm text-muted">
              Nothing assigned yet. <Link href="/assignments" className="text-brand underline">Assign training</Link> to track compliance.
            </p>
          )}
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="p-6 pb-3">
          <h2 className="font-display text-lg font-bold">Courses</h2>
          <p className="text-sm text-muted">All finished attempts since each course was published</p>
        </div>
        {r.courses.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-y border-border/60 text-left text-xs uppercase tracking-wider text-muted">
                  <th scope="col" className="px-6 py-2 font-semibold">Course</th>
                  <th scope="col" className="px-3 py-2 text-right font-semibold">Learners</th>
                  <th scope="col" className="px-3 py-2 text-right font-semibold">Attempts</th>
                  <th scope="col" className="px-3 py-2 text-right font-semibold">Pass rate</th>
                  <th scope="col" className="px-3 py-2 text-right font-semibold">Avg score</th>
                  <th scope="col" className="px-6 py-2 text-right font-semibold">Rating</th>
                </tr>
              </thead>
              <tbody>
                {r.courses.map((c) => (
                  <tr key={c.id} className="border-b border-border/40 last:border-0">
                    <td className="px-6 py-2.5">
                      <Link href={`/studio/${c.id}`} className="font-medium hover:text-brand">
                        <span aria-hidden>{c.icon}</span> {c.title}
                      </Link>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{c.learners}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{c.attempts}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{c.passRate == null ? "–" : `${c.passRate}%`}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{c.avgScore == null ? "–" : `${c.avgScore}%`}</td>
                    <td className="px-6 py-2.5 text-right tabular-nums">
                      {c.rating == null ? (
                        "–"
                      ) : (
                        <span className="inline-flex items-center gap-1">
                          <Star className="h-3.5 w-3.5 fill-accent text-accent" aria-hidden /> {c.rating}
                          <span className="text-xs text-muted">({c.ratings})</span>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-6 pt-0">
            <EmptyState title="No published courses" body="Publish a course in the studio to see it here." />
          </div>
        )}
      </Card>

      <Card className="p-6">
        <h2 className="font-display text-lg font-bold">Trickiest questions</h2>
        <p className="mb-4 text-sm text-muted">Lowest share of correct answers (at least 3 answers). Worth a look for unclear wording.</p>
        {r.hardest.length ? (
          <PercentBars
            rows={r.hardest.map((h) => ({
              key: h.slideId,
              label: h.course ? `${h.title} · ${h.course}` : h.title,
              pct: h.correctPct,
              detail: `${h.answers} answers`,
            }))}
          />
        ) : (
          <p className="text-sm text-muted">Not enough answers yet.</p>
        )}
      </Card>
    </div>
  );
}
