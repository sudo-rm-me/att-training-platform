"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, PartyPopper, Trash2 } from "lucide-react";
import { Button, Input, Label, Select, Textarea } from "@/components/ui";
import { createEventAction, deleteEventAction } from "./actions";

const EMOJIS = ["🎉", "🚀", "🎃", "🎄", "🌸", "☀️", "🏆", "⚡", "🧠", "🔒"];
const MULTIPLIERS = [
  { value: 150, label: "1.5× XP" },
  { value: 200, label: "2× XP (double)" },
  { value: 300, label: "3× XP (triple)" },
];

function localInput(d: Date) {
  const off = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - off).toISOString().slice(0, 16);
}

export function EventForm() {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [emoji, setEmoji] = React.useState(EMOJIS[0]);
  const now = new Date();
  now.setMinutes(0, 0, 0);
  const week = new Date(now.getTime() + 7 * 86_400_000);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const form = e.currentTarget;
    start(async () => {
      const res = await createEventAction({
        name: String(f.get("name")),
        description: String(f.get("description") ?? ""),
        emoji,
        startsAt: new Date(String(f.get("startsAt"))).toISOString(),
        endsAt: new Date(String(f.get("endsAt"))).toISOString(),
        xpMultiplier: Number(f.get("xpMultiplier")),
        teamChallenge: f.get("teamChallenge") === "on",
      });
      if (!res.ok) return void toast.error(res.error);
      toast.success(res.message);
      form.reset();
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <Label htmlFor="ev-name">Name</Label>
        <Input id="ev-name" name="name" required minLength={3} maxLength={80} placeholder="Cyber Security Week" className="mt-1.5" />
      </div>
      <fieldset>
        <legend className="text-sm font-medium">Icon</legend>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {EMOJIS.map((x) => (
            <button
              key={x}
              type="button"
              onClick={() => setEmoji(x)}
              aria-pressed={emoji === x}
              aria-label={`Icon ${x}`}
              className={`grid h-10 w-10 place-items-center rounded-xl border text-xl transition ${emoji === x ? "border-brand bg-brand/12" : "border-border hover:border-brand/50"}`}
            >
              {x}
            </button>
          ))}
        </div>
      </fieldset>
      <div>
        <Label htmlFor="ev-desc">Description</Label>
        <Textarea id="ev-desc" name="description" rows={2} maxLength={400} placeholder="Earn double XP on every course this week!" className="mt-1.5" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="ev-start">Starts</Label>
          <Input id="ev-start" name="startsAt" type="datetime-local" required defaultValue={localInput(now)} className="mt-1.5" />
        </div>
        <div>
          <Label htmlFor="ev-end">Ends</Label>
          <Input id="ev-end" name="endsAt" type="datetime-local" required defaultValue={localInput(week)} className="mt-1.5" />
        </div>
      </div>
      <div>
        <Label htmlFor="ev-mult">Bonus</Label>
        <Select id="ev-mult" name="xpMultiplier" defaultValue="200" className="mt-1.5">
          {MULTIPLIERS.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </Select>
      </div>
      <label className="flex items-start gap-3 rounded-xl border border-border p-3">
        <input type="checkbox" name="teamChallenge" defaultChecked className="mt-1 h-4 w-4 accent-[var(--brand)]" />
        <span>
          <span className="block font-semibold">Team challenge</span>
          <span className="text-sm text-muted">Show a live team leaderboard for XP earned during the event.</span>
        </span>
      </label>
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <PartyPopper className="h-4 w-4" />}
        Schedule event
      </Button>
    </form>
  );
}

export function DeleteEventButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  return (
    <Button
      size="sm"
      variant="ghost"
      aria-label={`Delete ${name}`}
      disabled={pending}
      onClick={() => {
        if (!confirm(`Delete "${name}"? XP already earned is kept.`)) return;
        start(async () => {
          const res = await deleteEventAction(id);
          if (!res.ok) return void toast.error(res.error);
          toast.success(res.message);
          router.refresh();
        });
      }}
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
    </Button>
  );
}
