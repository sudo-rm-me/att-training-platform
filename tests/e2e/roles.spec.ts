import { expect, test, type Page } from "@playwright/test";
import { ADMIN, LEARNER, MANAGER, TEAMMATE, expectAllowed, expectDenied, signInAs } from "./helpers";

test.describe.configure({ mode: "serial" });

const STAFF_PAGES = ["/admin/users", "/admin/audit", "/studio", "/assignments", "/team"];

let admin: Page;
let courseId = "";

test("redirects signed-out visitors to sign in", async ({ page }) => {
  await page.goto("/leaderboard");
  await expect(page).toHaveURL(/\/signin/);
  const res = await page.request.get("/api/certificates/00000000-0000-0000-0000-000000000000");
  expect(res.status()).toBe(401);
});

test("the bootstrap admin can reach every admin page", async ({ browser }) => {
  admin = await signInAs(browser, ADMIN);
  await expectAllowed(admin, "/admin/users", "People & roles");
  await expectAllowed(admin, "/admin/audit", "Audit log");
  await expectAllowed(admin, "/studio", /studio/i);
  await expectAllowed(admin, "/assignments", "Assignments");
  await expectAllowed(admin, "/team", "Team progress");

  // Seed a course to work with.
  await admin.goto("/courses");
  await admin.getByRole("button", { name: "Add sample course" }).click();
  await admin.waitForURL(/\/courses\/[0-9a-f-]{36}$/);
  courseId = admin.url().split("/").pop()!;
});

test("learners are kept out of staff pages and other people's certificates", async ({ browser }) => {
  const learner = await signInAs(browser, LEARNER);
  for (const path of STAFF_PAGES) await expectDenied(learner, path);

  // Staff navigation isn't shown either.
  await learner.goto("/");
  await expect(learner.getByRole("link", { name: "Course studio" })).toHaveCount(0);
  await expect(learner.getByRole("link", { name: "People & roles" })).toHaveCount(0);

  // No certificate for an unpassed course, and no peeking at someone else's.
  expect((await learner.request.get(`/api/certificates/${courseId}`)).status()).toBe(404);
  const adminId = await userIdFor(admin, ADMIN.email);
  expect((await learner.request.get(`/api/certificates/${courseId}?user=${adminId}`)).status()).toBe(404);
  await learner.context().close();
});

test("admins promote a manager, who sees only their own department", async ({ browser }) => {
  const manager = await signInAs(browser, MANAGER);
  const teammate = await signInAs(browser, TEAMMATE);
  await teammate.context().close();
  await expectDenied(manager, "/team");

  await setRole(admin, MANAGER.email, "manager");

  await expectAllowed(manager, "/assignments", "Assignments");
  await expectAllowed(manager, "/team", "Team progress");
  const main = manager.locator("main");
  await expect(main).toContainText(TEAMMATE.name);
  await expect(main).not.toContainText(LEARNER.name); // Sales, not Engineering
  // Managers still can't administer roles or author courses.
  await expectDenied(manager, "/admin/users");
  await expectDenied(manager, "/studio");
  await manager.context().close();
});

test("role changes are written to the audit log", async () => {
  await admin.goto("/admin/audit");
  await expect(admin.locator("tbody")).toContainText(`${MANAGER.name}: learner → manager`);
});

test("the last admin can't demote themselves", async () => {
  await setRole(admin, ADMIN.email, "learner", false);
  await expectAllowed(admin, "/admin/users", "People & roles");
});

// --- helpers --------------------------------------------------------------

async function rowFor(page: Page, email: string) {
  await page.goto(`/admin/users?q=${encodeURIComponent(email)}`);
  const row = page.locator("tbody tr", { hasText: email });
  await expect(row).toHaveCount(1);
  return row;
}

async function userIdFor(page: Page, email: string) {
  const row = await rowFor(page, email);
  return (await row.getAttribute("data-user-id")) ?? "";
}

async function setRole(page: Page, email: string, role: string, expectOk = true) {
  const row = await rowFor(page, email);
  await row.getByRole("combobox", { name: "Role" }).selectOption(role);
  await expect(page.getByText(expectOk ? "Role updated" : "There must be at least one admin.")).toBeVisible();
}
