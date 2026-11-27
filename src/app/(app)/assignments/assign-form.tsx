"use client";

import * as React from "react";
import { Building2, Globe2, Send, User as UserIcon } from "lucide-react";
import { toast } from "sonner";
import { Button, Input, Label, Select } from "@/components/ui";
import { cn } from "@/lib/utils";
import { createAssignmentAction } from "./actions";

type Target = "user" | "department" | "everyone";

export function AssignForm({
  courses,
  people,
  departments,
  allowEveryone,
  today,
}: {
  courses: { id: string; title: string; icon: string }[];
  people: { id: string; name: string; department: string | null }[];
  departments: string[];
  allowEveryone: boolean;
  today: string;
}) {
  const [target, setTarget] = React.useState<Target>(departments.length ? "department" : "user");
  const [pending, start] = React.useTransition();
  const formRef = React.useRef<HTMLFormElement>(null);

  const targets: { key: Target; label: string; icon: React.ReactNode; show: boolean }[] = [
    { key: "user", label: "A person", icon: <UserIcon className="h-4 w-4" />, show: people.length > 0 },
    { key: "department", label: "A department", icon: <Building2 className="h-4 w-4" />, show: departments.length > 0 },
    { key: "everyone", label: "Everyone", icon: <Globe2 className="h-4 w-4" />, show: allowEveryone },
  ];

  function submit(fd: FormData) {
    const str = (k: string) => {
      const v = fd.get(k);
      return typeof v === "string" && v.trim() ? v.trim() : undefined;
    };
    start(async () => {
      const res = await createAssignmentAction({
        courseId: str("courseId") ?? "",
        targetType: target,
        targetUserId: target === "user" ? str("targetUserId") : undefined,
        targetDepartment: target === "department" ? str("targetDepartment") : undefined,
        dueDate: str("dueDate"),
        note: str("note"),
      });
      if (res.ok) {
        toast.success(res.message);
        formRef.current?.reset();
      } else toast.error(res.error);
    });
  }

  return (
    <form ref={formRef} action={submit} className="space-y-5">
      <div>
        <Label htmlFor="courseId">Course</Label>
        <Select id="courseId" name="courseId" required defaultValue="">
          <option value="" disabled>
            Choose a course…
          </option>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.icon} {c.title}
            </option>
          ))}
        </Select>
      </div>

      <div>
        <Label>Assign to</Label>
        <div className="grid grid-cols-3 gap-2">
          {targets
            .filter((t) => t.show)
            .map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTarget(t.key)}
                aria-pressed={target === t.key}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-xl border-2 px-2 py-2.5 text-xs font-semibold transition",
                  target === t.key ? "border-brand bg-brand/8 text-brand" : "border-border text-muted hover:text-fg",
                )}
              >
                {t.icon}
                {t.label}
              </button>
            ))}
        </div>
      </div>

      {target === "user" && (
        <div>
          <Label htmlFor="targetUserId">Person</Label>
          <Select id="targetUserId" name="targetUserId" required defaultValue="">
            <option value="" disabled>
              Choose someone…
            </option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.department ? ` · ${p.department}` : ""}
              </option>
            ))}
          </Select>
        </div>
      )}
      {target === "department" && (
        <div>
          <Label htmlFor="targetDepartment">Department</Label>
          <Select id="targetDepartment" name="targetDepartment" required defaultValue={departments.length === 1 ? departments[0] : ""}>
            <option value="" disabled>
              Choose a department…
            </option>
            {departments.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </Select>
          <p className="mt-1.5 text-xs text-muted">Includes people who join the department later.</p>
        </div>
      )}
      {target === "everyone" && <p className="text-sm text-muted">Everyone in the organisation, including future starters.</p>}

      <div>
        <Label htmlFor="dueDate">
          Due date <span className="font-normal text-muted">(optional)</span>
        </Label>
        <Input id="dueDate" name="dueDate" type="date" min={today} />
      </div>
      <div>
        <Label htmlFor="note">
          Note <span className="font-normal text-muted">(optional)</span>
        </Label>
        <Input id="note" name="note" maxLength={500} placeholder="e.g. Required for the annual compliance audit" />
      </div>
      <Button type="submit" disabled={pending} className="w-full">
        <Send className="h-4 w-4" /> {pending ? "Assigning…" : "Assign training"}
      </Button>
    </form>
  );
}
