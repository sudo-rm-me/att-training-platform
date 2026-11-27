"use server";

import { and, eq, ilike, ne, or } from "drizzle-orm";
import { getDb } from "@/db";
import { courses, users } from "@/db/schema";
import { can, requireUser } from "@/lib/session";
import { BADGES } from "@/lib/badges";

export type SearchHit = { id: string; group: "Courses" | "People" | "Badges"; title: string; subtitle?: string; icon?: string; href: string };

/** Escape LIKE wildcards in user input. */
const like = (q: string) => `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

export async function searchAction(query: string): Promise<SearchHit[]> {
  const user = await requireUser();
  const q = query.trim().slice(0, 80);
  if (q.length < 2) return [];
  const db = await getDb();
  const pattern = like(q);
  const author = can.author(user.role);

  const courseRows = await db
    .select({ id: courses.id, title: courses.title, category: courses.category, icon: courses.icon, status: courses.status })
    .from(courses)
    .where(
      and(
        author ? ne(courses.status, "archived") : eq(courses.status, "published"),
        or(ilike(courses.title, pattern), ilike(courses.description, pattern), ilike(courses.category, pattern)),
      ),
    )
    .limit(6);

  const hits: SearchHit[] = courseRows.map((c) => ({
    id: `c:${c.id}`,
    group: "Courses",
    title: c.title,
    subtitle: c.status === "published" ? c.category : `${c.category} · ${c.status}`,
    icon: c.icon,
    href: c.status === "published" ? `/courses/${c.id}` : `/studio/${c.id}`,
  }));

  if (can.manage(user.role)) {
    const people = await db
      .select({ id: users.id, name: users.name, email: users.email, department: users.department })
      .from(users)
      .where(or(ilike(users.name, pattern), ilike(users.email, pattern)))
      .limit(5);
    for (const p of people)
      hits.push({
        id: `u:${p.id}`,
        group: "People",
        title: p.name,
        subtitle: [p.department, p.email].filter(Boolean).join(" · "),
        href: can.admin(user.role) ? `/admin/users?q=${encodeURIComponent(p.email)}` : "/team",
      });
  }

  const lower = q.toLowerCase();
  for (const b of BADGES.filter((b) => b.name.toLowerCase().includes(lower) || b.description.toLowerCase().includes(lower)).slice(0, 4))
    hits.push({ id: `b:${b.key}`, group: "Badges", title: b.name, subtitle: b.description, icon: b.emoji, href: "/badges" });

  return hits;
}
