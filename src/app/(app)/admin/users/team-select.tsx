"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Select } from "@/components/ui";
import { setMembersAction } from "../teams/actions";

export function TeamSelect({
  userId,
  teamId,
  teams,
}: {
  userId: string;
  teamId: string | null;
  teams: { id: string; name: string; icon: string }[];
}) {
  const [pending, start] = useTransition();
  return (
    <Select
      aria-label="Team"
      defaultValue={teamId ?? ""}
      disabled={pending}
      className="w-44"
      onChange={(e) => {
        const next = e.target.value || null;
        const el = e.currentTarget;
        start(async () => {
          const res = await setMembersAction([userId], next);
          if (res.ok) toast.success(res.message);
          else {
            toast.error(res.error);
            el.value = teamId ?? "";
          }
        });
      }}
    >
      <option value="">No team</option>
      {teams.map((t) => (
        <option key={t.id} value={t.id}>
          {t.icon} {t.name}
        </option>
      ))}
    </Select>
  );
}
