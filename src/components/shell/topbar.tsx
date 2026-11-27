import Link from "next/link";
import { Coins, LogOut, Sparkles } from "lucide-react";
import { signOut } from "@/auth";
import type { User } from "@/db/schema";
import { levelFromXp } from "@/lib/levels";
import { UserAvatar } from "@/components/user-avatar";
import { ThemeToggle } from "./theme-toggle";
import { MobileNav } from "./sidebar";
import { Reminders, type Reminder, type Update } from "./reminders";
import type { NavSection } from "./nav";

export function Topbar({
  user,
  sections,
  appName,
  reminders,
  updates,
}: {
  user: User;
  sections: NavSection[];
  appName: string;
  reminders: Reminder[];
  updates: Update[];
}) {
  const lvl = levelFromXp(user.xp);
  return (
    <header className="sticky top-0 z-30 flex items-center gap-3 px-4 py-4 md:px-8">
      <MobileNav sections={sections} appName={appName} />
      <div className="flex-1" />

      <div className="glass hidden items-center gap-3 rounded-2xl py-1.5 pl-1.5 pr-4 sm:flex" title={`${user.xp} XP total`}>
        <div className="grid h-8 w-8 place-items-center rounded-xl bg-brand-gradient font-display text-sm font-bold text-white">
          {lvl.level}
        </div>
        <div className="w-32">
          <div className="flex justify-between text-[11px] font-semibold">
            <span>{lvl.title}</span>
            <span className="text-muted tabular-nums">
              {lvl.xpIntoLevel}/{lvl.xpForNext} XP
            </span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-fg/10">
            <div className="h-full rounded-full bg-brand-gradient" style={{ width: `${lvl.progress * 100}%` }} />
          </div>
        </div>
      </div>

      <div className="glass flex h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-bold tabular-nums" title="Coins to spend in the shop">
        <Coins className="h-4 w-4 text-accent" />
        {user.coins}
      </div>

      <Reminders items={reminders} updates={updates} />

      <ThemeToggle />

      <details className="group relative">
        <summary className="flex cursor-pointer list-none items-center gap-2 rounded-full [&::-webkit-details-marker]:hidden">
          <UserAvatar name={user.name} avatar={user.avatar} className="ring-2 ring-white/60 dark:ring-white/10" />
        </summary>
        <div className="glass absolute right-0 mt-2 w-64 rounded-2xl bg-card-solid! p-2">
          <div className="px-3 py-2">
            <div className="font-semibold">{user.name}</div>
            <div className="truncate text-xs text-muted">{user.email}</div>
            <div className="mt-2 flex items-center gap-1 text-xs text-muted">
              <Sparkles className="h-3.5 w-3.5 text-brand" />
              <span className="capitalize">{user.role}</span>
              {user.department && <span>· {user.department}</span>}
            </div>
          </div>
          <div className="my-1 h-px bg-border" />
          <Link href="/" className="block rounded-xl px-3 py-2 text-sm hover:bg-fg/5">
            Dashboard
          </Link>
          <Link href="/certificates" className="block rounded-xl px-3 py-2 text-sm hover:bg-fg/5">
            My certificates
          </Link>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/signin" });
            }}
          >
            <button className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-danger hover:bg-danger/10">
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </form>
        </div>
      </details>
    </header>
  );
}
