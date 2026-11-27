export type NavIcon =
  | "home"
  | "courses"
  | "leaderboard"
  | "badges"
  | "avatar"
  | "shop"
  | "certificates"
  | "team"
  | "assignments"
  | "studio"
  | "users"
  | "audit"
  | "teams"
  | "reminders"
  | "kudos"
  | "events"
  | "reports";

export type NavItem = { href: string; label: string; icon: NavIcon };
export type NavSection = { title: string; items: NavItem[] };

import type { Translate } from "@/i18n/messages";

export type NavPerms = { author: boolean; manage: boolean; admin: boolean };

export function buildNav(p: NavPerms, t: Translate): NavSection[] {
  const sections: NavSection[] = [
    {
      title: t("nav.learn"),
      items: [
        { href: "/", label: t("nav.dashboard"), icon: "home" },
        { href: "/courses", label: t("nav.courses"), icon: "courses" },
        { href: "/leaderboard", label: t("nav.leaderboard"), icon: "leaderboard" },
        { href: "/badges", label: t("nav.badges"), icon: "badges" },
        { href: "/kudos", label: t("nav.kudos"), icon: "kudos" },
      ],
    },
    {
      title: t("nav.you"),
      items: [
        { href: "/avatar", label: t("nav.avatar"), icon: "avatar" },
        { href: "/shop", label: t("nav.shop"), icon: "shop" },
        { href: "/certificates", label: t("nav.certificates"), icon: "certificates" },
      ],
    },
  ];
  if (p.manage) {
    sections.push({
      title: t("nav.manage"),
      items: [
        { href: "/team", label: t("nav.team"), icon: "team" },
        { href: "/assignments", label: t("nav.assignments"), icon: "assignments" },
      ],
    });
  }
  if (p.author) {
    sections.push({ title: t("nav.create"), items: [{ href: "/studio", label: t("nav.studio"), icon: "studio" }] });
  }
  if (p.admin) {
    sections.push({
      title: t("nav.admin"),
      items: [
        { href: "/admin/reports", label: t("nav.reports"), icon: "reports" },
        { href: "/admin/users", label: t("nav.users"), icon: "users" },
        { href: "/admin/teams", label: t("nav.teams"), icon: "teams" },
        { href: "/admin/reminders", label: t("nav.reminders"), icon: "reminders" },
        { href: "/admin/events", label: t("nav.events"), icon: "events" },
        { href: "/admin/audit", label: t("nav.audit"), icon: "audit" },
      ],
    });
  }
  return sections;
}
