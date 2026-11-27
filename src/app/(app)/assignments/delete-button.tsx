"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui";
import { deleteAssignmentAction } from "./actions";

export function DeleteAssignmentButton({ id, title }: { id: string; title: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      variant="ghost"
      size="icon"
      disabled={pending}
      aria-label={`Remove assignment for ${title}`}
      title="Remove assignment"
      className="text-muted hover:bg-danger/10 hover:text-danger"
      onClick={() => {
        if (!confirm(`Remove this assignment of “${title}”? Progress and certificates are kept.`)) return;
        start(async () => {
          const res = await deleteAssignmentAction(id);
          if (res.ok) toast.success(res.message);
          else toast.error(res.error);
        });
      }}
    >
      <Trash2 className="h-4 w-4" />
    </Button>
  );
}
