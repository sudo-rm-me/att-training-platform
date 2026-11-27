"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Building2, Crown, Plus, Save, Trash2, UserMinus, UserPlus, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Button, Input, Label, Select, Textarea } from "@/components/ui";
import {
  addDepartmentAction,
  createTeamAction,
  deleteTeamAction,
  setLeadAction,
  setMembersAction,
  teamsFromDepartmentsAction,
  updateTeamAction,
} from "./actions";

type Res = { ok: true; message: string } | { ok: false; error: string };

function useRun() {
  const [pending, start] = React.useTransition();
  const run = (fn: () => Promise<Res | void>, after?: (r: Res) => void) =>
    start(async () => {
      const r = await fn();
      if (!r) return;
      if (r.ok) toast.success(r.message);
      else toast.error(r.error);
      after?.(r);
    });
  return [pending, run] as const;
}

const ICONS = ["👥", "🚀", "🛠️", "💼", "🎨", "📈", "🧪", "🛡️", "🌍", "🏢", "⚡", "🎧", "🧭", "🌱"];

function TeamFields({ name = "", icon = "👥", description = "" }: { name?: string; icon?: string; description?: string }) {
  const [current, setCurrent] = React.useState(icon);
  return (
    <>
      <div>
        <Label htmlFor="team-name">Name</Label>
        <Input id="team-name" name="name" required maxLength={80} defaultValue={name} placeholder="e.g. Customer Success" />
      </div>
      <div>
        <Label>Icon</Label>
        <input type="hidden" name="icon" value={current} />
        <div className="flex flex-wrap gap-1.5">
          {ICONS.map((i) => (
            <button
              key={i}
              type="button"
              onClick={() => setCurrent(i)}
              aria-pressed={current === i}
              aria-label={`Icon ${i}`}
              className={`grid h-9 w-9 place-items-center rounded-xl text-lg transition ${current === i ? "bg-brand/15 ring-2 ring-brand" : "bg-fg/5 hover:bg-fg/10"}`}
            >
              {i}
            </button>
          ))}
        </div>
      </div>
      <div>
        <Label htmlFor="team-desc">
          Description <span className="font-normal text-muted">(optional)</span>
        </Label>
        <Textarea id="team-desc" name="description" rows={2} maxLength={300} defaultValue={description} />
      </div>
    </>
  );
}

const read = (fd: FormData) => ({
  name: String(fd.get("name") ?? ""),
  icon: String(fd.get("icon") ?? "👥"),
  description: String(fd.get("description") ?? ""),
});

export function NewTeamForm() {
  const router = useRouter();
  const [pending, run] = useRun();
  return (
    <form
      className="space-y-4"
      action={(fd) =>
        run(
          () => createTeamAction(read(fd)),
          (r) => {
            const id = (r as { id?: string }).id;
            if (r.ok && id) router.push(`/admin/teams/${id}`);
          },
        )
      }
    >
      <TeamFields />
      <Button disabled={pending} className="w-full">
        <Plus className="h-4 w-4" /> {pending ? "Creating…" : "Create team"}
      </Button>
    </form>
  );
}

export function FromDepartmentsButton() {
  const [pending, run] = useRun();
  return (
    <Button
      variant="secondary"
      disabled={pending}
      onClick={() => {
        if (confirm("Create a team for each Entra department and put everyone who isn't in a team yet into theirs?"))
          run(() => teamsFromDepartmentsAction());
      }}
    >
      <Wand2 className="h-4 w-4" /> {pending ? "Working…" : "Create from departments"}
    </Button>
  );
}

export function EditTeamForm({ team }: { team: { id: string; name: string; icon: string; description: string } }) {
  const [pending, run] = useRun();
  return (
    <form className="space-y-4" action={(fd) => run(() => updateTeamAction(team.id, read(fd)))}>
      <TeamFields name={team.name} icon={team.icon} description={team.description} />
      <div className="flex gap-2">
        <Button disabled={pending} className="flex-1">
          <Save className="h-4 w-4" /> Save
        </Button>
        <DeleteTeamButton id={team.id} name={team.name} />
      </div>
    </form>
  );
}

function DeleteTeamButton({ id, name }: { id: string; name: string }) {
  const [pending, start] = React.useTransition();
  return (
    <Button
      type="button"
      variant="ghost"
      disabled={pending}
      className="text-danger hover:bg-danger/10"
      onClick={() => {
        if (confirm(`Delete the team “${name}”? Its members stay, but won't be in a team, and assignments to this team are removed.`))
          start(() => deleteTeamAction(id));
      }}
    >
      <Trash2 className="h-4 w-4" /> Delete
    </Button>
  );
}

export function AddMembers({
  teamId,
  people,
}: {
  teamId: string;
  people: { id: string; name: string; email: string; team: string | null }[];
}) {
  const [pending, run] = useRun();
  const [q, setQ] = React.useState("");
  const [picked, setPicked] = React.useState<Set<string>>(new Set());
  const shown = people
    .filter((p) => !q || `${p.name} ${p.email} ${p.team ?? ""}`.toLowerCase().includes(q.toLowerCase()))
    .slice(0, 100);
  const toggle = (id: string) =>
    setPicked((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  return (
    <div>
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search people to add…" aria-label="Search people" />
      <ul className="mt-2 max-h-72 overflow-y-auto rounded-xl border border-border">
        {shown.length === 0 && <li className="px-3 py-3 text-sm text-muted">Nobody matches.</li>}
        {shown.map((p) => (
          <li key={p.id} className="border-t border-border/60 first:border-t-0">
            <label className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-fg/[0.03]">
              <input type="checkbox" checked={picked.has(p.id)} onChange={() => toggle(p.id)} className="h-4 w-4 accent-[var(--brand)]" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{p.name}</span>
                <span className="block truncate text-xs text-muted">
                  {p.email}
                  {p.team ? ` · currently in ${p.team}` : " · no team"}
                </span>
              </span>
            </label>
          </li>
        ))}
      </ul>
      <Button
        className="mt-3 w-full"
        disabled={pending || picked.size === 0}
        onClick={() => run(() => setMembersAction([...picked], teamId), (r) => r.ok && setPicked(new Set()))}
      >
        <UserPlus className="h-4 w-4" /> Add {picked.size || ""} {picked.size === 1 ? "person" : "people"}
      </Button>
    </div>
  );
}

export function AddDepartment({ teamId, departments }: { teamId: string; departments: string[] }) {
  const [pending, run] = useRun();
  const [dept, setDept] = React.useState("");
  if (departments.length === 0) return null;
  return (
    <div className="flex gap-2">
      <Select value={dept} onChange={(e) => setDept(e.target.value)} aria-label="Department">
        <option value="">Add a whole department…</option>
        {departments.map((d) => (
          <option key={d} value={d}>
            {d}
          </option>
        ))}
      </Select>
      <Button variant="secondary" disabled={!dept || pending} onClick={() => run(() => addDepartmentAction(teamId, dept))}>
        <Building2 className="h-4 w-4" /> Add
      </Button>
    </div>
  );
}

export function RemoveMember({ userId, name }: { userId: string; name: string }) {
  const [pending, run] = useRun();
  return (
    <Button
      variant="ghost"
      size="icon"
      disabled={pending}
      title={`Remove ${name} from the team`}
      aria-label={`Remove ${name} from the team`}
      className="text-muted hover:bg-danger/10 hover:text-danger"
      onClick={() => run(() => setMembersAction([userId], null))}
    >
      <UserMinus className="h-4 w-4" />
    </Button>
  );
}

export function LeadToggle({ teamId, userId, name, lead }: { teamId: string; userId: string; name: string; lead: boolean }) {
  const [pending, run] = useRun();
  return (
    <Button
      variant={lead ? "secondary" : "ghost"}
      size="sm"
      disabled={pending}
      aria-pressed={lead}
      title={lead ? `Remove ${name} as lead` : `Make ${name} a team lead`}
      onClick={() => run(() => setLeadAction(teamId, userId, !lead))}
      className={lead ? "text-[color-mix(in_oklab,var(--accent)_60%,var(--fg))]" : "text-muted"}
    >
      <Crown className="h-4 w-4" /> {lead ? "Lead" : "Make lead"}
    </Button>
  );
}

export function AddLead({ teamId, people }: { teamId: string; people: { id: string; name: string; role: string }[] }) {
  const [pending, run] = useRun();
  const [id, setId] = React.useState("");
  return (
    <div className="flex gap-2">
      <Select value={id} onChange={(e) => setId(e.target.value)} aria-label="Lead from outside the team">
        <option value="">Add a lead from outside the team…</option>
        {people.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name} ({p.role})
          </option>
        ))}
      </Select>
      <Button variant="secondary" disabled={!id || pending} onClick={() => run(() => setLeadAction(teamId, id, true), () => setId(""))}>
        <Crown className="h-4 w-4" /> Add
      </Button>
    </div>
  );
}
