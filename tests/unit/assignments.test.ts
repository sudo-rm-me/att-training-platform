import { describe, expect, it } from "vitest";
import type { Assignment } from "@/db/schema";
import { appliesTo, canManageUser, dueState, dueText, mergeForUser } from "@/lib/assignments";

const DAY = 86_400_000;
const now = new Date("2026-06-15T12:00:00Z");

function a(p: Partial<Assignment>): Assignment {
  return {
    id: crypto.randomUUID(),
    courseId: "c1",
    targetType: "everyone",
    targetUserId: null,
    targetDepartment: null,
    dueAt: null,
    note: null,
    assignedBy: null,
    createdAt: now,
    ...p,
  } as Assignment;
}

describe("dueState", () => {
  it("classifies done, overdue, due soon and open", () => {
    expect(dueState(new Date(now.getTime() - DAY), true, now)).toBe("done");
    expect(dueState(new Date(now.getTime() - 1000), false, now)).toBe("overdue");
    expect(dueState(new Date(now.getTime() + 3 * DAY), false, now)).toBe("due_soon");
    expect(dueState(new Date(now.getTime() + 30 * DAY), false, now)).toBe("open");
    expect(dueState(null, false, now)).toBe("open");
  });
});

describe("dueText", () => {
  it("reads naturally", () => {
    expect(dueText(null, now)).toBe("No due date");
    expect(dueText(new Date(now.getTime() + DAY), now)).toBe("Due tomorrow");
    expect(dueText(new Date(now.getTime() + 5 * DAY), now)).toBe("Due in 5 days");
    expect(dueText(new Date(now.getTime() - 3 * DAY), now)).toBe("Overdue by 3 days");
  });
});

describe("appliesTo", () => {
  const u = { id: "u1", department: "Engineering", teamId: "t1" };
  it("matches everyone, the user, and the department case-insensitively", () => {
    expect(appliesTo(a({ targetType: "everyone" }), u)).toBe(true);
    expect(appliesTo(a({ targetType: "user", targetUserId: "u1" }), u)).toBe(true);
    expect(appliesTo(a({ targetType: "user", targetUserId: "u2" }), u)).toBe(false);
    expect(appliesTo(a({ targetType: "department", targetDepartment: " engineering " }), u)).toBe(true);
    expect(appliesTo(a({ targetType: "department", targetDepartment: "Sales" }), u)).toBe(false);
    expect(appliesTo(a({ targetType: "team", targetTeamId: "t1" }), u)).toBe(true);
    expect(appliesTo(a({ targetType: "team", targetTeamId: "t2" }), u)).toBe(false);
    expect(appliesTo(a({ targetType: "team", targetTeamId: "t1" }), { id: "u4", department: null, teamId: null })).toBe(false);
    expect(appliesTo(a({ targetType: "department", targetDepartment: "Sales" }), { id: "u3", department: null, teamId: null })).toBe(false);
  });
});

describe("canManageUser", () => {
  const m = (role: "admin" | "manager" | "learner" | "author", department: string | null, leadTeamIds: string[] = []) => ({
    role,
    department,
    leadTeamIds,
  });
  const t = (department: string | null, teamId: string | null = null) => ({ department, teamId });

  it("lets admins manage anyone", () => {
    expect(canManageUser(m("admin", null), t("Sales"))).toBe(true);
  });

  it("scopes managers without teams to their own department", () => {
    expect(canManageUser(m("manager", "Sales"), t("sales"))).toBe(true);
    expect(canManageUser(m("manager", "Sales"), t("Engineering"))).toBe(false);
    expect(canManageUser(m("manager", null), t(null))).toBe(false);
  });

  it("scopes team leads to the teams they lead, ignoring department", () => {
    const lead = m("manager", "Sales", ["t1", "t2"]);
    expect(canManageUser(lead, t("Engineering", "t1"))).toBe(true);
    expect(canManageUser(lead, t("Sales", "t3"))).toBe(false);
    expect(canManageUser(lead, t("Sales", null))).toBe(false);
  });

  it("never lets learners or authors manage anyone", () => {
    expect(canManageUser(m("learner", "Sales", ["t1"]), t("Sales", "t1"))).toBe(false);
    expect(canManageUser(m("author", "Sales"), t("Sales"))).toBe(false);
  });
});

describe("mergeForUser", () => {
  it("keeps the earliest due date when several assignments cover the same course", () => {
    const early = new Date(now.getTime() + 2 * DAY);
    const late = new Date(now.getTime() + 9 * DAY);
    const merged = mergeForUser(
      [
        a({ targetType: "everyone", dueAt: null }),
        a({ targetType: "department", targetDepartment: "Engineering", dueAt: late }),
        a({ targetType: "user", targetUserId: "u1", dueAt: early, note: "urgent" }),
        a({ courseId: "c2", targetType: "department", targetDepartment: "Sales", dueAt: early }),
      ],
      { id: "u1", department: "Engineering", teamId: null },
    );
    expect([...merged.keys()]).toEqual(["c1"]);
    expect(merged.get("c1")).toMatchObject({ dueAt: early, note: "urgent" });
  });
});
