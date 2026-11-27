import Link from "next/link";
import { Bell } from "lucide-react";
import type { DueState } from "@/lib/assignments";
import { DueChip } from "@/components/due-chip";

export type Reminder = { courseId: string; title: string; icon: string; state: DueState; text: string };

/** Topbar bell listing overdue and soon-due assigned training. */
export function Reminders({ items }: { items: Reminder[] }) {
  const overdue = items.filter((i) => i.state === "overdue").length;
  return (
    <details className="group relative">
      <summary
        className="glass relative grid h-10 w-10 cursor-pointer list-none place-items-center rounded-xl [&::-webkit-details-marker]:hidden"
        aria-label={items.length ? `${items.length} training reminders` : "No reminders"}
        title="Training reminders"
      >
        <Bell className="h-4.5 w-4.5" />
        {items.length > 0 && (
          <span
            className={
              "absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full px-1 text-[11px] font-bold text-white shadow " +
              (overdue ? "bg-danger animate-pulse" : "bg-brand")
            }
          >
            {items.length}
          </span>
        )}
      </summary>
      <div className="glass absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-2xl bg-card-solid! p-2">
        <div className="px-3 py-2 text-sm font-bold">Reminders</div>
        {items.length === 0 ? (
          <p className="px-3 pb-3 text-sm text-muted">Nothing due right now. You&apos;re on top of it! 🎉</p>
        ) : (
          <ul className="max-h-96 overflow-y-auto">
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
      </div>
    </details>
  );
}
