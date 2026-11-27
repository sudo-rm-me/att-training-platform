"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Award,
  BookOpen,
  Boxes,
  BellRing,
  CalendarHeart,
  HeartHandshake,
  ClipboardList,
  GraduationCap,
  History,
  Home,
  Menu,
  PenTool,
  ScrollText,
  ShoppingBag,
  Smile,
  Trophy,
  Users,
  UsersRound,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { NavIcon, NavSection } from "./nav";

const ICONS: Record<NavIcon, React.ComponentType<{ className?: string }>> = {
  home: Home,
  courses: BookOpen,
  leaderboard: Trophy,
  badges: Award,
  avatar: Smile,
  shop: ShoppingBag,
  certificates: ScrollText,
  team: UsersRound,
  assignments: ClipboardList,
  studio: PenTool,
  users: Users,
  audit: History,
  teams: Boxes,
  reminders: BellRing,
  kudos: HeartHandshake,
  events: CalendarHeart,
};

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");
}

function NavList({ sections, onNavigate }: { sections: NavSection[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-6">
      {sections.map((s) => (
        <div key={s.title}>
          <div className="mb-2 px-3 text-[11px] font-bold uppercase tracking-[0.16em] text-muted/80">{s.title}</div>
          <ul className="flex flex-col gap-1">
            {s.items.map((item) => {
              const Icon = ICONS[item.icon];
              const active = isActive(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    className={cn(
                      "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all",
                      active
                        ? "bg-brand-gradient text-white shadow-[0_8px_20px_-8px_var(--brand)]"
                        : "text-muted hover:bg-card hover:text-fg",
                    )}
                  >
                    <Icon className={cn("h-[18px] w-[18px]", !active && "group-hover:text-brand")} />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function Brand({ appName }: { appName: string }) {
  return (
    <Link href="/" className="flex items-center gap-2.5 px-2">
      <div className="grid h-10 w-10 place-items-center rounded-2xl bg-brand-gradient text-white shadow-[0_8px_20px_-8px_var(--brand)]">
        <GraduationCap className="h-5 w-5" />
      </div>
      <span className="font-display text-xl font-bold tracking-tight">{appName}</span>
    </Link>
  );
}

export function Sidebar({ sections, appName }: { sections: NavSection[]; appName: string }) {
  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col gap-8 p-5 lg:flex">
      <div className="glass flex h-full flex-col gap-8 rounded-3xl p-4">
        <Brand appName={appName} />
        <div className="flex-1 overflow-y-auto">
          <NavList sections={sections} />
        </div>
      </div>
    </aside>
  );
}

export function MobileNav({ sections, appName }: { sections: NavSection[]; appName: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="lg:hidden">
      <button
        aria-label="Open menu"
        onClick={() => setOpen(true)}
        className="glass grid h-10 w-10 place-items-center rounded-xl"
      >
        <Menu className="h-5 w-5" />
      </button>
      {open && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="glass absolute inset-y-3 left-3 flex w-72 flex-col gap-8 rounded-3xl bg-card-solid p-4">
            <div className="flex items-center justify-between">
              <Brand appName={appName} />
              <button aria-label="Close menu" onClick={() => setOpen(false)} className="p-2">
                <X className="h-5 w-5" />
              </button>
            </div>
            <NavList sections={sections} onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}
    </div>
  );
}
