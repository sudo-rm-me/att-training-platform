import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { slides, users, type Role } from "@/db/schema";

let n = 0;

/** Insert a user straight into the test database. */
export async function makeUser(p: { role?: Role; department?: string | null; name?: string } = {}) {
  const db = await getDb();
  n++;
  const [u] = await db
    .insert(users)
    .values({
      email: `user${n}-${crypto.randomUUID().slice(0, 6)}@test.local`,
      name: p.name ?? `Test User ${n}`,
      role: p.role ?? "learner",
      department: p.department === undefined ? "Engineering" : p.department,
    })
    .returning();
  return u;
}

export async function reloadUser(id: string) {
  const db = await getDb();
  const [u] = await db.select().from(users).where(eq(users.id, id));
  return u;
}

export async function questionSlides(courseId: string) {
  const db = await getDb();
  const rows = await db.select().from(slides).where(eq(slides.courseId, courseId));
  return rows.filter((s) => s.kind === "question" && s.question);
}
