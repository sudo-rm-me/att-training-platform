import { AlarmClock, CalendarClock, CheckCircle2, ClipboardList, RefreshCw } from "lucide-react";
import type { DueState } from "@/lib/assignments";
import { cn } from "@/lib/utils";

const STYLES: Record<DueState, string> = {
  overdue: "bg-danger/12 text-danger",
  due_soon: "bg-accent/20 text-[color-mix(in_oklab,var(--accent)_55%,var(--fg))]",
  open: "bg-brand/10 text-brand",
  done: "bg-success/12 text-success",
  renew: "bg-accent/20 text-[color-mix(in_oklab,var(--accent)_55%,var(--fg))]",
};

export function DueChip({ state, text, className }: { state: DueState; text: string; className?: string }) {
  const Icon = state === "overdue" ? AlarmClock : state === "done" ? CheckCircle2 : state === "renew" ? RefreshCw : state === "due_soon" ? CalendarClock : ClipboardList;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold", STYLES[state], className)}>
      <Icon className="h-3.5 w-3.5" />
      {text}
    </span>
  );
}
