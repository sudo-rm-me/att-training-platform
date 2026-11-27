import { beforeAll, describe, expect, it } from "vitest";
import { getDb } from "@/db";
import { assignments, attempts, type Course } from "@/db/schema";
import { installSampleCourse } from "@/lib/sample-course";
import { getMyAssignments, managedPeople, passedPairs } from "@/lib/assignments";
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

    const mine = await getMyAssignments(member.id, member.department);
    expect(mine.map((m) => m.course.id)).toContain(course.id);
    expect(mine.find((m) => m.course.id === course.id)?.state).toBe("due_soon");
    expect((await getMyAssignments(outsider.id, outsider.department)).map((m) => m.course.id)).not.toContain(course.id);

    await db.insert(attempts).values({ userId: member.id, courseId: course.id, completedAt: new Date(), score: 90, passed: true });
    expect((await passedPairs([member.id])).has(`${member.id}:${course.id}`)).toBe(true);
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
    const [a] = (await getMyAssignments(u.id, u.department)).filter((m) => m.course.id === course.id);
    expect(a.state).toBe("overdue");
  });

  it("scopes managers to their own department", async () => {
    const dept = `Team-${crypto.randomUUID().slice(0, 6)}`;
    const manager = await makeUser({ role: "manager", department: dept });
    await makeUser({ department: dept });
    await makeUser({ department: "Somewhere else" });
    const people = await managedPeople(manager);
    expect(people.length).toBe(2);
    expect(people.every((p) => p.department === dept)).toBe(true);

    const noDept = await makeUser({ role: "manager", department: null });
    expect(await managedPeople(noDept)).toEqual([]);
  });
});
