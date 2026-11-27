import "server-only";
import { eq, or, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { teams, users, type User } from "@/db/schema";

const initialAdmins = () =>
  (process.env.INITIAL_ADMIN_EMAILS ?? "")
    .split(/[,;\s]+/)
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

export type SignInProfile = {
  entraOid: string | null;
  email: string;
  name: string;
  department: string | null;
  jobTitle: string | null;
};

/** Create or refresh the local user row on sign-in. Never demotes a role. */
export async function upsertUserFromSignIn(p: SignInProfile): Promise<User> {
  const db = await getDb();
  const email = p.email.trim().toLowerCase();
  if (!email) throw new Error("Signed-in identity has no email/UPN");
  const isBootstrapAdmin = initialAdmins().includes(email);

  const [existing] = await db
    .select()
    .from(users)
    .where(p.entraOid ? or(eq(users.entraOid, p.entraOid), eq(users.email, email)) : eq(users.email, email))
    .limit(1);

  if (existing) {
    const [updated] = await db
      .update(users)
      .set({
        entraOid: p.entraOid ?? existing.entraOid,
        email,
        name: p.name || existing.name,
        // Keep values that were set before if Graph didn't return them.
        department: p.department ?? existing.department,
        jobTitle: p.jobTitle ?? existing.jobTitle,
        role: isBootstrapAdmin ? "admin" : existing.role,
        lastSeenAt: new Date(),
      })
      .where(eq(users.id, existing.id))
      .returning();
    return updated;
  }

  // New starters join the team named after their department, if there is one.
  const [team] = p.department?.trim()
    ? await db
        .select({ id: teams.id })
        .from(teams)
        .where(sql`lower(${teams.name}) = lower(${p.department.trim()})`)
        .limit(1)
    : [];

  const [created] = await db
    .insert(users)
    .values({
      entraOid: p.entraOid,
      email,
      name: p.name || email,
      department: p.department,
      jobTitle: p.jobTitle,
      role: isBootstrapAdmin ? "admin" : "learner",
      teamId: team?.id ?? null,
    })
    .returning();
  return created;
}
