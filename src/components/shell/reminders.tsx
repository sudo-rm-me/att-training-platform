import Link from "next/link";
import { Bell, CheckCheck, Hand, Megaphone, Users } from "lucide-react";
import type { DueState } from "@/lib/assignments";
import { DueChip } from "@/components/due-chip";
import { markNotificationsReadAction } from "@/app/notification-actions";
import { cn } from "@/lib/utils";

export type Reminder = { courseId: string; title: string; icon: string; state: DueState; text: string };
export type Update = { id: string; kind: string; title: string; body: string; link: string | null; unread: boolean; at: string };

function ago(iso: string) {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (mins < 60) return `${mins || 1}m ago`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

const KIND_ICON = { nudge: Hand, summary: Users, reminder: Megaphone } as const;

/** Topbar bell: training that's due, plus reminders, nudges and digests. */
export function Reminders({ items, updates = [] }: { items: Reminder[]; updates?: Update[] }) {
  const overdue = items.filter((i) => i.state === "overdue").length;
  const unread = updates.filter((u) => u.unread).length;
  const badge = items.length + unread;
  return (
    <details className="group relative">
      <summary
        className="glass relative grid h-10 w-10 cursor-pointer list-none place-items-center rounded-xl [&::-webkit-details-marker]:hidden"
        aria-label={badge ? `${items.length} training reminders, ${unread} unread notifications` : "No reminders"}
        title="Reminders and notifications"
      >
        <Bell className="h-4.5 w-4.5" />
        {badge > 0 && (
          <span
            className={
              "absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full px-1 text-[11px] font-bold text-white shadow " +
              (overdue ? "bg-danger animate-pulse" : "bg-brand")
            }
          >
            {badge}
          </span>
        )}
      </summary>
      <div className="glass absolute right-0 mt-2 w-96 max-w-[calc(100vw-2rem)] rounded-2xl bg-card-solid! p-2">
        <div className="max-h-[70vh] overflow-y-auto">
          <div className="px-3 py-2 text-sm font-bold">To do</div>
          {items.length === 0 ? (
            <p className="px-3 pb-3 text-sm text-muted">Nothing due right now. You&apos;re on top of it! 🎉</p>
          ) : (
            <ul>
              {items.map((r) => (
                <li key={r.courseId}>
                  <Link href={`/courses/${r.courseId}`} className="flex items-start gap-3 rounded-xl px-3 py-2.5 hover:bg-fg/5">
                    <span className="text-2xl leading-none">{r.icon}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{r.title}</span>
                      <DueChip state={r.state} text={r.text} className="mt-1" />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}

          {updates.length > 0 && (
            <>
              <div className="mt-1 flex items-center justify-between border-t border-border/60 px-3 pb-1 pt-3">
                <span className="text-sm font-bold">Updates</span>
                {unread > 0 && (
                  <form action={markNotificationsReadAction}>
                    <button className="flex items-center gap-1 text-xs font-semibold text-brand hover:underline">
                      <CheckCheck className="h-3.5 w-3.5" /> Mark all read
                    </button>
                  </form>
                )}
              </div>
              <ul>
                {updates.map((u) => {
                  const Icon = KIND_ICON[u.kind as keyof typeof KIND_ICON] ?? Megaphone;
                  const body = (
                    <>
                      <span className={cn("mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg", u.unread ? "bg-brand/15 text-brand" : "bg-fg/5 text-muted")}>
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={cn("block text-sm", u.unread ? "font-semibold" : "text-muted")}>{u.title}</span>
                        {u.body && <span className="block truncate text-xs text-muted">{u.body}</span>}
                        <span className="text-[11px] text-muted">{ago(u.at)}</span>
                      </span>
                      {u.unread && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-brand" aria-label="Unread" />}
                    </>
                  );
                  return (
                    <li key={u.id}>
                      {u.link ? (
                        <Link href={u.link} className="flex items-start gap-3 rounded-xl px-3 py-2 hover:bg-fg/5">
                          {body}
                        </Link>
                      ) : (
                        <div className="flex items-start gap-3 px-3 py-2">{body}</div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>
      </div>
    </details>
  );
}
