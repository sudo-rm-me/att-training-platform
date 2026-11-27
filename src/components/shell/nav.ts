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
  | "users";

export type NavItem = { href: string; label: string; icon: NavIcon };
export type NavSection = { title: string; items: NavItem[] };

export type NavPerms = { author: boolean; manage: boolean; admin: boolean };

export function buildNav(p: NavPerms): NavSection[] {
  const sections: NavSection[] = [
    {
      title: "Learn",
      items: [{ href: "/", label: "Dashboard", icon: "home" }],
    },
  ];
  if (p.admin) {
    sections.push({ title: "Admin", items: [{ href: "/admin/users", label: "People & roles", icon: "users" }] });
  }
  return sections;
}
