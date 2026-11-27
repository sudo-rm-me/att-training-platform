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
  | "events";

export type NavItem = { href: string; label: string; icon: NavIcon };
export type NavSection = { title: string; items: NavItem[] };

export type NavPerms = { author: boolean; manage: boolean; admin: boolean };

export function buildNav(p: NavPerms): NavSection[] {
  const sections: NavSection[] = [
    {
      title: "Learn",
      items: [
        { href: "/", label: "Dashboard", icon: "home" },
        { href: "/courses", label: "Courses", icon: "courses" },
        { href: "/leaderboard", label: "Leaderboard", icon: "leaderboard" },
        { href: "/badges", label: "Badges", icon: "badges" },
        { href: "/kudos", label: "Kudos", icon: "kudos" },
      ],
    },
    {
      title: "You",
      items: [
        { href: "/avatar", label: "Avatar", icon: "avatar" },
        { href: "/shop", label: "Shop", icon: "shop" },
        { href: "/certificates", label: "Certificates", icon: "certificates" },
      ],
    },
  ];
  if (p.manage) {
    sections.push({
      title: "Manage",
      items: [
        { href: "/team", label: "Team progress", icon: "team" },
        { href: "/assignments", label: "Assignments", icon: "assignments" },
      ],
    });
  }
  if (p.author) {
    sections.push({ title: "Create", items: [{ href: "/studio", label: "Course studio", icon: "studio" }] });
  }
  if (p.admin) {
    sections.push({
      title: "Admin",
      items: [
        { href: "/admin/users", label: "People & roles", icon: "users" },
        { href: "/admin/teams", label: "Teams", icon: "teams" },
        { href: "/admin/reminders", label: "Reminders", icon: "reminders" },
        { href: "/admin/events", label: "Events", icon: "events" },
        { href: "/admin/audit", label: "Audit log", icon: "audit" },
      ],
    });
  }
  return sections;
}
