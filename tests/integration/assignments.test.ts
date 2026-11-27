import { beforeAll, describe, expect, it } from "vitest";
import { getDb } from "@/db";
import { eq } from "drizzle-orm";
import { assignments, attempts, teamLeads, teams, users, type Course } from "@/db/schema";
import { installSampleCourse } from "@/lib/sample-course";
import { getMyAssignments, latestPasses, managedPeople } from "@/lib/assignments";
import { scopeFor } from "@/lib/teams";
import { makeUser } from "../support/db";

let course: Course;

beforeAll(async () => {
  const admin = await makeUser({ role: "admin" });
  course = await installSampleCourse(admin.id);
});

describe("assignments", () => {
  it("shows a department assignment to members only, and marks it done after a pass", async () => {
    const db = await getDb();
    const dept = `Dept-${crypto.randomUUID().slice(0, 6)}`;
    const member = await makeUser({ department: dept });
    const outsider = await makeUser({ department: "Elsewhere" });
    const due = new Date(Date.now() + 2 * 86_400_000);
    await db.insert(assignments).values({ courseId: course.id, targetType: "department", targetDepartment: dept, dueAt: due });

    const mine = await getMyAssignments(member.id, member.department, member.teamId);
    expect(mine.map((m) => m.course.id)).toContain(course.id);
    expect(mine.find((m) => m.course.id === course.id)?.state).toBe("due_soon");
    expect((await getMyAssignments(outsider.id, outsider.department, outsider.teamId)).map((m) => m.course.id)).not.toContain(course.id);

    await db.insert(attempts).values({ userId: member.id, courseId: course.id, completedAt: new Date(), score: 90, passed: true });
    expect((await latestPasses([member.id])).has(`${member.id}:${course.id}`)).toBe(true);
  });

  it("shows overdue training as overdue", async () => {
    const db = await getDb();
    const u = await makeUser();
    await db.insert(assignments).values({
      courseId: course.id,
      targetType: "user",
      targetUserId: u.id,
      dueAt: new Date(Date.now() - 86_400_000),
    });
    const [a] = (await getMyAssignments(u.id, u.department, u.teamId)).filter((m) => m.course.id === course.id);
    expect(a.state).toBe("overdue");
  });

  it("scopes managers to their own department", async () => {
    const dept = `Team-${crypto.randomUUID().slice(0, 6)}`;
    const manager = await makeUser({ role: "manager", department: dept });
    await makeUser({ department: dept });
    await makeUser({ department: "Somewhere else" });
    const people = await managedPeople(await scopeFor(manager));
    expect(people.length).toBe(2);
    expect(people.every((p) => p.department === dept)).toBe(true);

    const noDept = await makeUser({ role: "manager", department: null });
    expect(await managedPeople(await scopeFor(noDept))).toEqual([]);
  });
});

describe("teams", () => {
  it("scopes team leads to their teams' members, across departments", async () => {
    const db = await getDb();
    const [team] = await db.insert(teams).values({ name: `Rockets ${crypto.randomUUID().slice(0, 6)}` }).returning();
    const lead = await makeUser({ role: "manager", department: "Sales" });
    const inTeam = await makeUser({ department: "Engineering" });
    const sameDeptNotTeam = await makeUser({ department: "Sales" });
    await db.update(users).set({ teamId: team.id }).where(eq(users.id, inTeam.id));
    await db.insert(teamLeads).values({ teamId: team.id, userId: lead.id });

    const scope = await scopeFor(lead);
    expect(scope.leadTeamIds).toEqual([team.id]);
    const people = (await managedPeople(scope)).map((p) => p.id);
    expect(people).toContain(inTeam.id);
    expect(people).not.toContain(sameDeptNotTeam.id);
  });

  it("delivers team assignments to members only", async () => {
    const db = await getDb();
    const [team] = await db.insert(teams).values({ name: `Comets ${crypto.randomUUID().slice(0, 6)}` }).returning();
    const member = await makeUser();
    const other = await makeUser();
    await db.update(users).set({ teamId: team.id }).where(eq(users.id, member.id));
    await db.insert(assignments).values({ courseId: course.id, targetType: "team", targetTeamId: team.id });
    expect((await getMyAssignments(member.id, member.department, team.id)).map((m) => m.course.id)).toContain(course.id);
    expect((await getMyAssignments(other.id, other.department, null)).map((m) => m.course.id)).not.toContain(course.id);
  });

  it("ignores lead entries for people who aren't managers", async () => {
    const db = await getDb();
    const [team] = await db.insert(teams).values({ name: `Stars ${crypto.randomUUID().slice(0, 6)}` }).returning();
    const learner = await makeUser({ role: "learner" });
    await db.insert(teamLeads).values({ teamId: team.id, userId: learner.id });
    const scope = await scopeFor(learner);
    expect(scope.leadTeamIds).toEqual([]);
    expect(await managedPeople(scope)).toEqual([]);
  });
});
