"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import confetti from "canvas-confetti";
import { toast } from "sonner";
import { Coins, HeartHandshake, Loader2, Search, X } from "lucide-react";
import type { AvatarConfig } from "@/db/schema";
import { Button, Input, Label, Textarea } from "@/components/ui";
import { UserAvatar } from "@/components/user-avatar";
import { cn } from "@/lib/utils";
import { sendKudosAction } from "./actions";

export type Colleague = { id: string; name: string; department: string | null; avatar: AvatarConfig | null };

export function SendKudosForm({
  colleagues,
  amounts,
  remaining,
  balance,
}: {
  colleagues: Colleague[];
  amounts: readonly number[];
  remaining: number;
  balance: number;
}) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [to, setTo] = React.useState<Colleague | null>(null);
  const [coins, setCoins] = React.useState<number>(amounts[1] ?? amounts[0]);
  const [message, setMessage] = React.useState("");
  const [pending, start] = React.useTransition();
  const listId = React.useId();

  const q = query.trim().toLowerCase();
  const matches = q
    ? colleagues.filter((c) => c.name.toLowerCase().includes(q) || c.department?.toLowerCase().includes(q)).slice(0, 6)
    : [];

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!to) return toast.error("Choose who to thank.");
    start(async () => {
      const res = await sendKudosAction({ toId: to.id, coins, message });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      confetti({ particleCount: 90, spread: 70, origin: { y: 0.6 }, colors: ["#ff7ab6", "#ffb547", "#6d4aff"] });
      toast.success(res.message);
      for (const b of res.badges) toast.success(`Badge unlocked: ${b} 🏅`);
      setTo(null);
      setQuery("");
      setMessage("");
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div>
        <Label htmlFor={`${listId}-who`}>Who do you want to thank?</Label>
        {to ? (
          <div className="mt-1.5 flex items-center gap-3 rounded-xl border border-border bg-surface/60 p-2.5">
            <UserAvatar name={to.name} avatar={to.avatar} className="h-9 w-9" />
            <div className="min-w-0 flex-1">
              <div className="truncate font-semibold">{to.name}</div>
              {to.department && <div className="truncate text-xs text-muted">{to.department}</div>}
            </div>
            <button
              type="button"
              onClick={() => setTo(null)}
              className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-surface hover:text-fg"
              aria-label={`Remove ${to.name}`}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="relative mt-1.5">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <Input
              id={`${listId}-who`}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or department"
              className="pl-9"
              autoComplete="off"
              role="combobox"
              aria-expanded={matches.length > 0}
              aria-controls={`${listId}-list`}
            />
            {matches.length > 0 && (
              <ul
                id={`${listId}-list`}
                role="listbox"
                className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-border bg-card-solid! shadow-xl"
              >
                {matches.map((c) => (
                  <li key={c.id} role="option" aria-selected={false}>
                    <button
                      type="button"
                      onClick={() => setTo(c)}
                      className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-brand/10 focus:bg-brand/10 focus:outline-none"
                    >
                      <UserAvatar name={c.name} avatar={c.avatar} className="h-8 w-8" />
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{c.name}</span>
                        {c.department && <span className="block truncate text-xs text-muted">{c.department}</span>}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <fieldset>
        <legend className="text-sm font-medium">Coins to give</legend>
        <div className="mt-1.5 grid grid-cols-4 gap-2">
          {amounts.map((a) => {
            const disabled = a > remaining || a > balance;
            return (
              <button
                key={a}
                type="button"
                disabled={disabled}
                onClick={() => setCoins(a)}
                aria-pressed={coins === a}
                className={cn(
                  "flex h-11 items-center justify-center gap-1.5 rounded-xl border font-display font-bold transition",
                  coins === a ? "border-brand bg-brand/12 text-brand" : "border-border hover:border-brand/50",
                  disabled && "cursor-not-allowed opacity-40",
                )}
              >
                <Coins className="h-4 w-4 text-accent" /> {a}
              </button>
            );
          })}
        </div>
        <p className="mt-1.5 text-xs text-muted">
          You have {balance.toLocaleString()} coins · {remaining} left to give in the next 24 hours.
        </p>
      </fieldset>

      <div>
        <Label htmlFor={`${listId}-msg`}>What did they do?</Label>
        <Textarea
          id={`${listId}-msg`}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={280}
          rows={3}
          placeholder="Thanks for walking me through the new expenses process!"
          className="mt-1.5"
        />
        <div className="mt-1 text-right text-xs text-muted">{message.length}/280</div>
      </div>

      <Button type="submit" className="w-full" disabled={pending || !to || remaining <= 0}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <HeartHandshake className="h-4 w-4" />}
        Send kudos
      </Button>
    </form>
  );
}
