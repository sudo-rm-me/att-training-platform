"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Select } from "@/components/ui";
import { setUserRole } from "./actions";

const ROLES = [
  { value: "learner", label: "Learner" },
  { value: "manager", label: "Manager" },
  { value: "author", label: "Author" },
  { value: "admin", label: "Admin" },
];

export function RoleSelect({ userId, role }: { userId: string; role: string }) {
  const [pending, start] = useTransition();
  return (
    <Select
      aria-label="Role"
      defaultValue={role}
      disabled={pending}
      className="w-36"
      onChange={(e) => {
        const next = e.target.value;
        const el = e.currentTarget;
        start(async () => {
          const res = await setUserRole(userId, next);
          if (res.ok) toast.success("Role updated");
          else {
            toast.error(res.error);
            el.value = role;
          }
        });
      }}
    >
      {ROLES.map((r) => (
        <option key={r.value} value={r.value}>
          {r.label}
        </option>
      ))}
    </Select>
  );
}
