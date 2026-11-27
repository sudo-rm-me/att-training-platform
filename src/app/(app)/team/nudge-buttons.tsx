"use client";

import * as React from "react";
import { Hand, Megaphone } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui";
import { nudgeOverdueAction, nudgeUserAction } from "./actions";

type Res = { ok: true; message: string } | { ok: false; error: string };

function useRun() {
  const [pending, start] = React.useTransition();
  const run = (fn: () => Promise<Res>) =>
    start(async () => {
      const r = await fn();
      if (r.ok) toast.success(r.message);
      else toast.error(r.error);
    });
  return [pending, run] as const;
}

export function NudgeUserButton({ userId, name }: { userId: string; name: string }) {
  const [pending, run] = useRun();
  return (
    <Button variant="secondary" size="sm" disabled={pending} onClick={() => run(() => nudgeUserAction(userId))} aria-label={`Nudge ${name}`}>
      <Hand className="h-4 w-4" /> {pending ? "Sending…" : "Nudge"}
    </Button>
  );
}

export function NudgeOverdueButton({ teamId, department, count }: { teamId: string | null; department: string | null; count: number }) {
  const [pending, run] = useRun();
  return (
    <Button
      variant="secondary"
      disabled={pending}
      onClick={() => {
        if (confirm(`Send a reminder to everyone with overdue training (${count} ${count === 1 ? "course" : "courses"})?`))
          run(() => nudgeOverdueAction({ teamId, department }));
      }}
    >
      <Megaphone className="h-4 w-4" /> {pending ? "Sending…" : "Nudge all overdue"}
    </Button>
  );
}
