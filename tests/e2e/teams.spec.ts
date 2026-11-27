import { expect, test, type Page } from "@playwright/test";
import { ADMIN, LEARNER, TEAMMATE, expectAllowed, expectDenied, signInAs, type Persona } from "./helpers";

test.describe.configure({ mode: "serial" });

const LEAD: Persona = { email: "lola@e2e.test", name: "Lola Lead", department: "Marketing" };
const TEAM = `Rockets ${Date.now().toString(36)}`;

let admin: Page;

test("admins create a team, add people from different departments and pick a lead", async ({ browser }) => {
  // Everyone has to have signed in once to exist.
  for (const p of [LEAD, LEARNER, TEAMMATE]) await (await signInAs(browser, p)).context().close();

  admin = await signInAs(browser, ADMIN);
  await expectAllowed(admin, "/admin/teams", "Teams");
  await admin.getByLabel("Name").fill(TEAM);
  await admin.getByRole("button", { name: "Icon 🚀" }).click();
  await admin.getByRole("button", { name: "Create team" }).click();
  await admin.waitForURL(/\/admin\/teams\/[0-9a-f-]{36}$/);
  await expect(admin.getByRole("heading", { level: 1 })).toContainText(TEAM);

  // Add the Sales learner and the Marketing lead as members.
  for (const p of [LEARNER, LEAD]) {
    await admin.getByLabel("Search people").fill(p.email);
    await admin.getByRole("checkbox").first().check();
    await admin.getByRole("button", { name: /^Add 1 person/ }).click();
    await expect(admin.getByText(`Moved 1 person to ${TEAM}`)).toBeVisible();
  }
  const members = admin.locator("li", { hasText: LEAD.email });
  await members.getByRole("button", { name: "Make lead" }).click();
  await expect(admin.getByText(`${LEAD.name} is now a lead.`)).toBeVisible();
});

test("a team lead manages exactly their team's members", async ({ browser }) => {
  const lead = await signInAs(browser, LEAD);
  await expectAllowed(lead, "/team", "Team progress");
  const main = lead.locator("main");
  await expect(main).toContainText(LEARNER.name); // Sales, but in the team
  await expect(main).not.toContainText(TEAMMATE.name); // not in the team
  await expectDenied(lead, "/admin/teams");

  // Leads can assign to their team.
  await expectAllowed(lead, "/assignments", "Assignments");
  await expect(lead.getByRole("button", { name: "A team" })).toBeVisible();
  await expect(lead.getByRole("button", { name: "Everyone" })).toHaveCount(0);
  await lead.context().close();
});

test("team changes are audited and the team shows on the leaderboard", async () => {
  await admin.goto("/admin/audit");
  const log = admin.locator("tbody");
  await expect(log).toContainText(`${LEAD.name} now leads ${TEAM}`);
  await expect(log).toContainText(`${LEAD.name}: learner → manager`);

  await admin.goto("/leaderboard?view=teams&period=all");
  await expect(admin.locator("main")).toContainText(TEAM);
});

test("admins can run reminders and see the set-up checklist", async () => {
  await expectAllowed(admin, "/admin/reminders", "Reminders");
  await expect(admin.locator("main")).toContainText("Daily schedule");
  await admin.getByRole("button", { name: "Run reminders now" }).click();
  await expect(admin.getByText(/Sent \d+ reminders|Nothing new to send/)).toBeVisible();
  await admin.goto("/admin/audit");
  await expect(admin.locator("tbody")).toContainText("manager digests");
});
