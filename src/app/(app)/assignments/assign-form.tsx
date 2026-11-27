"use client";

import * as React from "react";
import { Building2, Globe2, Send, User as UserIcon, Users } from "lucide-react";
import { toast } from "sonner";
import { Button, Input, Label, Select } from "@/components/ui";
import { cn } from "@/lib/utils";
import { createAssignmentAction } from "./actions";

type Target = "user" | "department" | "everyone" | "team";

export function AssignForm({
  courses,
  people,
  departments,
  teams,
  allowEveryone,
  today,
}: {
  courses: { id: string; title: string; icon: string }[];
  people: { id: string; name: string; department: string | null }[];
  departments: string[];
  teams: { id: string; name: string; icon: string }[];
  allowEveryone: boolean;
  today: string;
}) {
  const [target, setTarget] = React.useState<Target>(teams.length ? "team" : departments.length ? "department" : "user");
  const [pending, start] = React.useTransition();
  const formRef = React.useRef<HTMLFormElement>(null);

  const targets: { key: Target; label: string; icon: React.ReactNode; show: boolean }[] = [
    { key: "team", label: "A team", icon: <Users className="h-4 w-4" />, show: teams.length > 0 },
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
        targetTeamId: target === "team" ? str("targetTeamId") : undefined,
        dueDate: str("dueDate"),
        note: str("note"),
        recurMonths: str("recurMonths") ? Number(str("recurMonths")) : undefined,
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
        <div className="grid grid-cols-2 gap-2">
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

      {target === "team" && (
        <div>
          <Label htmlFor="targetTeamId">Team</Label>
          <Select id="targetTeamId" name="targetTeamId" required defaultValue={teams.length === 1 ? teams[0].id : ""}>
            <option value="" disabled>
              Choose a team…
            </option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.icon} {t.name}
              </option>
            ))}
          </Select>
          <p className="mt-1.5 text-xs text-muted">Includes people added to the team later.</p>
        </div>
      )}
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
        <Label htmlFor="recurMonths">Repeat</Label>
        <Select id="recurMonths" name="recurMonths" defaultValue="">
          <option value="">One-off</option>
          <option value="6">Every 6 months</option>
          <option value="12">Every year</option>
          <option value="24">Every 2 years</option>
          <option value="36">Every 3 years</option>
        </Select>
        <p className="mt-1 text-xs text-muted">Recurring training expires after the period, and people are reminded to retake it 30 days before.</p>
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
