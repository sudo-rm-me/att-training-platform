import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { assignments, attempts, notifications, teamLeads, teams, users, type Course } from "@/db/schema";
import { installSampleCourse } from "@/lib/sample-course";
import { addMonths, getMyAssignments } from "@/lib/assignments";
import { runReminders, sendNudges } from "@/lib/reminders";
import { makeUser } from "../support/db";

const DAY = 86_400_000;
let course: Course;

beforeAll(async () => {
  const admin = await makeUser({ role: "admin" });
  course = await installSampleCourse(admin.id);
});

const inbox = async (userId: string) => (await getDb()).select().from(notifications).where(eq(notifications.userId, userId));

describe("reminders", () => {
  it("reminds learners once per stage and sends managers an escalating digest", async () => {
    const db = await getDb();
    const [team] = await db.insert(teams).values({ name: `Squad ${crypto.randomUUID().slice(0, 6)}` }).returning();
    const lead = await makeUser({ role: "manager", name: "Lead Person" });
    const late = await makeUser({ name: "Late Person" });
    const soon = await makeUser({ name: "Soon Person" });
    await db.update(users).set({ teamId: team.id }).where(eq(users.id, late.id));
    await db.update(users).set({ teamId: team.id }).where(eq(users.id, soon.id));
    await db.insert(teamLeads).values({ teamId: team.id, userId: lead.id });
    await db.insert(assignments).values([
      { courseId: course.id, targetType: "user", targetUserId: late.id, dueAt: new Date(Date.now() - 20 * DAY) },
      { courseId: course.id, targetType: "user", targetUserId: soon.id, dueAt: new Date(Date.now() + 3 * DAY) },
    ]);

    const first = await runReminders();
    expect(first.learnerReminders).toBeGreaterThanOrEqual(2);
    expect((await inbox(late.id)).map((n) => n.title)).toEqual([`${course.title} is overdue`]);
    expect((await inbox(soon.id)).map((n) => n.title)).toEqual([`${course.title} is due soon`]);
    const digest = await inbox(lead.id);
    expect(digest).toHaveLength(1);
    expect(digest[0].body).toMatch(/1 overdue for more than 14 days/);
    expect(first.escalations).toBeGreaterThanOrEqual(1);

    // Running again the same day sends nothing new.
    const second = await runReminders();
    expect(second.learnerReminders).toBe(0);
    expect(second.leadDigests).toBe(0);
    expect(await inbox(late.id)).toHaveLength(1);
  });

  it("asks people to renew recurring training before it expires", async () => {
    const db = await getDb();
    const u = await makeUser();
    await db.insert(assignments).values({ courseId: course.id, targetType: "user", targetUserId: u.id, recurMonths: 12 });
    await db.insert(attempts).values({
      userId: u.id,
      courseId: course.id,
      score: 100,
      passed: true,
      completedAt: addMonths(new Date(Date.now() + 10 * DAY), -12),
    });
    const [mine] = (await getMyAssignments(u.id, u.department, u.teamId)).filter((a) => a.course.id === course.id);
    expect(mine.state).toBe("renew");
    await runReminders();
    expect((await inbox(u.id)).map((n) => n.title)).toEqual([`Time to renew ${course.title}`]);
  });

  it("limits nudges to one per person and course per day", async () => {
    const u = await makeUser();
    const target = { user: u, courseId: course.id, title: course.title, text: "Overdue by 2 days" };
    expect(await sendNudges({ name: "Boss" }, [target])).toMatchObject({ sent: 1, people: 1 });
    expect(await sendNudges({ name: "Boss" }, [target])).toMatchObject({ sent: 0, skipped: 1 });
    expect((await inbox(u.id))[0].title).toBe(`Boss nudged you: ${course.title}`);
  });
});
