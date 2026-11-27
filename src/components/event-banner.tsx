"use client";

import * as React from "react";
import Link from "next/link";
import { Users, Zap } from "lucide-react";

export type BannerEvent = {
  name: string;
  description: string;
  emoji: string;
  startsAt: string;
  endsAt: string;
  xpMultiplier: number;
  teamChallenge: boolean;
};

function left(ms: number) {
  if (ms <= 0) return "now";
  const d = Math.floor(ms / 86_400_000);
  const h = Math.floor((ms % 86_400_000) / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${s.toString().padStart(2, "0")}s`;
}

/** Live or upcoming seasonal event, with a ticking countdown. */
export function EventBanner({ event, initiallyLive }: { event: BannerEvent; initiallyLive: boolean }) {
  const [now, setNow] = React.useState<number | null>(null);
  React.useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const t = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, []);
  const start = Date.parse(event.startsAt);
  const end = Date.parse(event.endsAt);
  const live = now == null ? initiallyLive : now >= start;
  const target = live ? end : start;
  const mult = event.xpMultiplier / 100;

  return (
    <div className="relative overflow-hidden rounded-3xl border border-white/20 bg-[linear-gradient(120deg,#f59e0b,#ec4899_55%,#8b5cf6)] p-5 text-white shadow-xl">
      <div className="pointer-events-none absolute -right-6 -top-10 text-[9rem] leading-none opacity-20 select-none" aria-hidden>
        {event.emoji}
      </div>
      <div className="relative flex flex-wrap items-center gap-4">
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-white/20 text-3xl backdrop-blur">{event.emoji}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-white/85">
            {live ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-white/25 px-2 py-0.5">
                <span className="h-2 w-2 animate-pulse rounded-full bg-white" /> Live now
              </span>
            ) : (
              <span>Coming up</span>
            )}
            <span className="inline-flex items-center gap-1">
              <Zap className="h-3.5 w-3.5" /> {mult}× XP
            </span>
            {event.teamChallenge && (
              <span className="inline-flex items-center gap-1">
                <Users className="h-3.5 w-3.5" /> Team challenge
              </span>
            )}
          </div>
          <h2 className="mt-1 font-display text-2xl font-bold">{event.name}</h2>
          {event.description && <p className="text-sm text-white/90">{event.description}</p>}
        </div>
        <div className="text-right">
          <div className="text-xs font-semibold uppercase tracking-wider text-white/80">{live ? "Ends in" : "Starts in"}</div>
          <div className="font-display text-2xl font-extrabold tabular-nums" suppressHydrationWarning>
            {now == null ? "…" : left(target - now)}
          </div>
          {event.teamChallenge && live && (
            <Link href="/leaderboard?view=teams" className="mt-1 inline-block text-sm font-semibold underline underline-offset-4">
              Team standings →
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
