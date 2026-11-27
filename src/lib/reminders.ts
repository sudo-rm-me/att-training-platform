import "server-only";
import { inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { courses, deliveryLog, teamLeads, teams, users, type User } from "@/db/schema";
import { APP_NAME } from "@/lib/brand";
import { isCompliant, latestPasses, mergeForUser, publishedAssignments, requirementStatus, sameDept, statusText, type RequirementStatus } from "@/lib/assignments";
import { mailHtml, sendMail } from "@/lib/mail";
import { notify, type NewNotification } from "@/lib/notifications";
import { postToTeams } from "@/lib/teams-webhook";

const DAY = 86_400_000;

export const appUrl = () => (process.env.APP_URL || process.env.AUTH_URL || "http://localhost:3000").replace(/\/$/, "");
export const escalateAfterDays = () => Math.max(1, Number(process.env.ESCALATE_AFTER_DAYS) || 14);

/** ISO week key like 2026-W48, so weekly messages go out once a week. */
export function isoWeek(d: Date) {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y = t.getUTCFullYear();
  const week = Math.ceil(((t.getTime() - Date.UTC(y, 0, 1)) / DAY + 1) / 7);
  return `${y}-W${String(week).padStart(2, "0")}`;
}
const dayKey = (d: Date) => d.toISOString().slice(0, 10);

/** Which reminder (if any) a requirement is due for right now. Pure, for tests. */
export function reminderStage(st: RequirementStatus, now: Date): { stage: string; key: string } | null {
  const left = st.dueAt ? st.dueAt.getTime() - now.getTime() : null;
  switch (st.state) {
    case "renew": {
      const at = dayKey(st.validUntil!);
      return left! <= 7 * DAY ? { stage: "renew7", key: `renew7:${at}` } : { stage: "renew30", key: `renew30:${at}` };
    }
    case "overdue":
      return { stage: "overdue", key: `overdue:${isoWeek(now)}` };
    case "due_soon":
      return left! <= DAY ? { stage: "due1", key: `due1:${dayKey(st.dueAt!)}` } : { stage: "due7", key: `due7:${dayKey(st.dueAt!)}` };
    default:
      return null;
  }
}

/** Claim idempotency keys; returns the ones this run owns (not sent before). */
async function claim(keys: string[]) {
  if (keys.length === 0) return new Set<string>();
  const db = await getDb();
  const got = await db
    .insert(deliveryLog)
    .values(keys.map((key) => ({ key })))
    .onConflictDoNothing()
    .returning({ key: deliveryLog.key });
  return new Set(got.map((g) => g.key));
}

type Item = { courseId: string; title: string; icon: string; st: RequirementStatus; text: string; daysOverdue: number };

/** Open requirements for these people (everyone when omitted). */
export async function snapshot(now: Date, only?: User[]) {
  const db = await getDb();
  const [people, all] = await Promise.all([only ?? db.select().from(users), publishedAssignments()]);
  const ids = [...new Set(all.map((a) => a.courseId))];
  const [passes, courseRows] = await Promise.all([
    latestPasses(people.map((p) => p.id)),
    ids.length ? db.select({ id: courses.id, title: courses.title, icon: courses.icon }).from(courses).where(inArray(courses.id, ids)) : [],
  ]);
  const info = new Map(courseRows.map((c) => [c.id, c]));
  const byUser = new Map<string, { total: number; done: number; open: Item[] }>();
  for (const p of people) {
    const reqs = mergeForUser(all, p);
    const row = { total: reqs.size, done: 0, open: [] as Item[] };
    for (const [courseId, req] of reqs) {
      const st = requirementStatus(req, passes.get(`${p.id}:${courseId}`) ?? null, now);
      if (st.state === "done") row.done++;
      else {
        if (isCompliant(st.state)) row.done++;
        const c = info.get(courseId);
        const daysOverdue = st.state === "overdue" && st.dueAt ? Math.floor((now.getTime() - st.dueAt.getTime()) / DAY) : 0;
        row.open.push({ courseId, title: c?.title ?? "Course", icon: c?.icon ?? "📘", st, text: statusText(st, now), daysOverdue });
      }
    }
    byUser.set(p.id, row);
  }
  return { people, byUser };
}

/** People a manager is responsible for (same rule as the Team page). */
function managedBy(m: User, leadTeams: Map<string, string[]>, people: User[]) {
  const lt = leadTeams.get(m.id) ?? [];
  if (lt.length) return people.filter((p) => p.teamId && lt.includes(p.teamId) && p.id !== m.id);
  if (!m.department?.trim()) return [];
  return people.filter((p) => p.id !== m.id && sameDept(m.department, p.department));
}

export type RunSummary = { learnerReminders: number; emails: number; leadDigests: number; escalations: number; teamPosts: number };

/**
 * The daily job. Safe to run any number of times: every message has an
 * idempotency key, so a person gets each reminder once.
 *  - learners: 7 days and 1 day before the due date, 30 and 7 days before a
 *    recurring pass expires, and weekly while overdue
 *  - managers: a weekly digest of their people's overdue training, flagging
 *    anything overdue for more than ESCALATE_AFTER_DAYS
 *  - teams with a Teams webhook: a weekly progress post
 */
export async function runReminders(now = new Date()): Promise<RunSummary> {
  const db = await getDb();
  const sum: RunSummary = { learnerReminders: 0, emails: 0, leadDigests: 0, escalations: 0, teamPosts: 0 };
  const { people, byUser } = await snapshot(now);
  const base = appUrl();

  // 1. Learners
  const learnerKeys: { user: User; item: Item; key: string; stage: string }[] = [];
  for (const p of people) {
    for (const item of byUser.get(p.id)?.open ?? []) {
      const r = reminderStage(item.st, now);
      if (r) learnerKeys.push({ user: p, item, stage: r.stage, key: `${r.key}:${p.id}:${item.courseId}` });
    }
  }
  const owned = await claim(learnerKeys.map((k) => k.key));
  const fresh = learnerKeys.filter((k) => owned.has(k.key));
  const perUser = new Map<string, typeof fresh>();
  for (const f of fresh) perUser.set(f.user.id, [...(perUser.get(f.user.id) ?? []), f]);
  const notes: NewNotification[] = [];
  for (const [, list] of perUser) {
    const u = list[0].user;
    for (const f of list) {
      notes.push({
        userId: u.id,
        kind: "reminder",
        title: f.stage.startsWith("renew") ? `Time to renew ${f.item.title}` : f.stage === "overdue" ? `${f.item.title} is overdue` : `${f.item.title} is due soon`,
        body: f.item.text,
        link: `/courses/${f.item.courseId}`,
      });
    }
    const overdue = list.filter((f) => f.stage === "overdue").length;
    const ok = await sendMail({
      to: u.email,
      subject: overdue ? `Overdue training: ${list.map((f) => f.item.title).join(", ")}` : `Training reminder: ${list.map((f) => f.item.title).join(", ")}`,
      html: mailHtml({
        appName: APP_NAME,
        heading: `Hi ${u.name.split(" ")[0]}, you have training waiting`,
        lines: list.map((f) => `${f.item.icon} ${f.item.title}: ${f.item.text}`),
        cta: { label: "Open my training", href: `${base}/` },
      }),
    });
    if (ok) sum.emails++;
  }
  await notify(notes);
  sum.learnerReminders = notes.length;

  // 2. Manager digests
  const leadRows = await db.select().from(teamLeads);
  const leadTeams = new Map<string, string[]>();
  for (const l of leadRows) leadTeams.set(l.userId, [...(leadTeams.get(l.userId) ?? []), l.teamId]);
  const week = isoWeek(now);
  const managers = people.filter((p) => p.role === "manager" || (p.role === "admin" && leadTeams.has(p.id)));
  const digestOwned = await claim(managers.map((m) => `digest:${week}:${m.id}`));
  const limit = escalateAfterDays();
  for (const m of managers) {
    if (!digestOwned.has(`digest:${week}:${m.id}`)) continue;
    const late = managedBy(m, leadTeams, people)
      .map((p) => ({ p, items: (byUser.get(p.id)?.open ?? []).filter((i) => i.st.state === "overdue") }))
      .filter((r) => r.items.length);
    if (late.length === 0) continue;
    const escalated = late.filter((r) => r.items.some((i) => i.daysOverdue > limit));
    sum.leadDigests++;
    sum.escalations += escalated.length;
    await notify({
      userId: m.id,
      kind: "summary",
      title: `${late.length} ${late.length === 1 ? "person has" : "people have"} overdue training`,
      body: escalated.length ? `${escalated.length} overdue for more than ${limit} days.` : "Send them a nudge from the Team page.",
      link: "/team",
    });
    await sendMail({
      to: m.email,
      subject: `${escalated.length ? "Escalation: " : ""}${late.length} of your people have overdue training`,
      html: mailHtml({
        appName: APP_NAME,
        heading: escalated.length ? `${escalated.length} overdue for more than ${limit} days` : "Weekly overdue training summary",
        lines: late.map(
          (r) => `${r.p.name}: ${r.items.map((i) => `${i.title} (${i.daysOverdue} days)`).join(", ")}${r.items.some((i) => i.daysOverdue > limit) ? " ⚠ escalated" : ""}`,
        ),
        cta: { label: "Open team progress", href: `${base}/team` },
      }),
    });
  }

  // 3. Teams channel posts
  const hooked = (await db.select().from(teams)).filter((t) => t.webhookUrl);
  const postOwned = await claim(hooked.map((t) => `teams:${week}:${t.id}`));
  for (const t of hooked) {
    if (!postOwned.has(`teams:${week}:${t.id}`)) continue;
    const members = people.filter((p) => p.teamId === t.id);
    let total = 0;
    let done = 0;
    let overdue = 0;
    for (const p of members) {
      const r = byUser.get(p.id);
      if (!r) continue;
      total += r.total;
      done += r.done;
      overdue += r.open.filter((i) => i.st.state === "overdue").length;
    }
    if (total === 0) continue;
    const ok = await postToTeams(t.webhookUrl!, {
      title: `${t.icon} ${t.name}: weekly training update`,
      text: overdue ? `${overdue} overdue ${overdue === 1 ? "course" : "courses"}. Let's clear them this week!` : "Everyone is on track. Great work! 🎉",
      facts: [
        { title: "Complete", value: `${Math.round((done / total) * 100)}% (${done}/${total})` },
        { title: "Overdue", value: String(overdue) },
        { title: "Members", value: String(members.length) },
      ],
      link: { label: `Open ${APP_NAME}`, href: `${base}/leaderboard?view=teams` },
    });
    if (ok) sum.teamPosts++;
  }
  return sum;
}

/** A manager's one-off nudge. At most one per person per course per day. */
export async function sendNudges(from: Pick<User, "name">, targets: { user: User; courseId: string; title: string; text: string }[], now = new Date()) {
  const keyOf = (t: (typeof targets)[number]) => `nudge:${dayKey(now)}:${t.user.id}:${t.courseId}`;
  const owned = await claim(targets.map(keyOf));
  const fresh = targets.filter((t) => owned.has(keyOf(t)));
  const perUser = new Map<string, typeof fresh>();
  for (const f of fresh) perUser.set(f.user.id, [...(perUser.get(f.user.id) ?? []), f]);
  const base = appUrl();
  for (const [, list] of perUser) {
    const u = list[0].user;
    await notify(
      list.map((f) => ({ userId: u.id, kind: "nudge" as const, title: `${from.name} nudged you: ${f.title}`, body: f.text, link: `/courses/${f.courseId}` })),
    );
    await sendMail({
      to: u.email,
      subject: `${from.name} sent you a reminder`,
      html: mailHtml({
        appName: APP_NAME,
        heading: `${from.name} is cheering you on 💪`,
        lines: [`Please complete: ${list.map((f) => `${f.title} (${f.text})`).join(", ")}`],
        cta: { label: "Start now", href: `${base}/courses/${list[0].courseId}` },
      }),
    });
  }
  return { sent: fresh.length, skipped: targets.length - fresh.length, people: perUser.size };
}
