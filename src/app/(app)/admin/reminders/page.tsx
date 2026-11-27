import { count, desc, like } from "drizzle-orm";
import { BellRing, CheckCircle2, CircleDashed, Clock, Mail, MessageSquare } from "lucide-react";
import { getDb } from "@/db";
import { deliveryLog, teams } from "@/db/schema";
import { requirePermission } from "@/lib/session";
import { mailConfigured } from "@/lib/mail";
import { RENEW_WINDOW_DAYS } from "@/lib/assignments";
import { escalateAfterDays } from "@/lib/reminders";
import { Card, PageHeader } from "@/components/ui";
import { RunRemindersButton } from "./run-button";

export const metadata = { title: "Reminders" };

function Status({ ok, label, hint }: { ok: boolean; label: string; hint: string }) {
  return (
    <li className="flex items-start gap-3 py-3">
      {ok ? <CheckCircle2 className="mt-0.5 h-5 w-5 text-success" /> : <CircleDashed className="mt-0.5 h-5 w-5 text-muted" />}
      <div>
        <div className="font-semibold">{label}</div>
        <div className="text-sm text-muted">{hint}</div>
      </div>
    </li>
  );
}

export default async function RemindersPage() {
  await requirePermission("admin");
  const db = await getDb();
  const [[{ sent }], [{ nudges }], [last], teamRows] = await Promise.all([
    db.select({ sent: count() }).from(deliveryLog),
    db.select({ nudges: count() }).from(deliveryLog).where(like(deliveryLog.key, "nudge:%")),
    db.select().from(deliveryLog).orderBy(desc(deliveryLog.sentAt)).limit(1),
    db.select({ webhookUrl: teams.webhookUrl }).from(teams),
  ]);
  const hooked = teamRows.filter((t) => t.webhookUrl).length;
  const cron = !!process.env.CRON_SECRET;
  const mail = mailConfigured();

  return (
    <div>
      <PageHeader
        eyebrow="Admin"
        title="Reminders"
        subtitle="Automatic nudges so assigned and recurring training gets done on time."
        actions={<RunRemindersButton />}
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <h2 className="mb-2 flex items-center gap-2 font-display text-lg font-bold">
            <BellRing className="h-5 w-5 text-brand" /> What gets sent
          </h2>
          <ul className="space-y-2 text-sm">
            <li>📅 <b>Learners:</b> 7 days and 1 day before a due date, then weekly while overdue.</li>
            <li>↻ <b>Recurring training:</b> {RENEW_WINDOW_DAYS} and 7 days before a pass expires.</li>
            <li>📋 <b>Managers and team leads:</b> a weekly digest of overdue training, flagging anyone overdue for more than {escalateAfterDays()} days.</li>
            <li>💬 <b>Teams channels:</b> a weekly progress post for teams with a webhook.</li>
            <li>👋 <b>Nudges:</b> managers can nudge people from the Team page (once per course per day).</li>
          </ul>
          <p className="mt-4 text-sm text-muted">
            Everything also lands in the in-app bell. Each message goes out once, so running the job again is safe.
          </p>
        </Card>
        <Card className="p-6">
          <h2 className="mb-1 font-display text-lg font-bold">Set-up</h2>
          <ul className="divide-y divide-border/60">
            <Status
              ok={cron}
              label="Daily schedule"
              hint={cron ? "CRON_SECRET is set. The Azure job calls the app every morning." : "Set CRON_SECRET (done for you by the Azure deployment). Until then, use Run reminders now."}
            />
            <Status
              ok={mail}
              label="Email"
              hint={mail ? `Sending from ${process.env.MAIL_SENDER}.` : "Set MAIL_SENDER and grant the Entra app the Mail.Send application permission. Until then, reminders show in the app only."}
            />
            <Status
              ok={hooked > 0}
              label="Microsoft Teams"
              hint={hooked ? `${hooked} ${hooked === 1 ? "team posts" : "teams post"} to a channel.` : "Add a channel webhook URL on a team's page under Admin → Teams."}
            />
          </ul>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl bg-fg/5 p-3">
              <div className="flex items-center gap-1.5 text-muted">
                <Mail className="h-4 w-4" /> Messages sent
              </div>
              <div className="font-display text-2xl font-bold tabular-nums">{sent}</div>
              <div className="text-xs text-muted">{nudges} nudges</div>
            </div>
            <div className="rounded-xl bg-fg/5 p-3">
              <div className="flex items-center gap-1.5 text-muted">
                <Clock className="h-4 w-4" /> Last sent
              </div>
              <div className="font-semibold">
                {last ? last.sentAt.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: process.env.APP_TIMEZONE || "Europe/London" }) : "Never"}
              </div>
              <div className="flex items-center gap-1 text-xs text-muted">
                <MessageSquare className="h-3 w-3" /> {hooked} Teams channels
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
