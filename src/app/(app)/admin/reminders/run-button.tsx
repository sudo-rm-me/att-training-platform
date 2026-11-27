"use client";

import * as React from "react";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui";
import { runRemindersAction } from "./actions";

export function RunRemindersButton() {
  const [pending, start] = React.useTransition();
  return (
    <Button
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await runRemindersAction();
          toast.success(r.message);
        })
      }
    >
      <Send className="h-4 w-4" /> {pending ? "Sending…" : "Run reminders now"}
    </Button>
  );
}
