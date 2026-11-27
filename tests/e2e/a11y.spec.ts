import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { ADMIN, signInAs } from "./helpers";

const PAGES = [
  "/",
  "/courses",
  "/leaderboard",
  "/badges",
  "/kudos",
  "/avatar",
  "/shop",
  "/certificates",
  "/team",
  "/assignments",
  "/studio",
  "/admin/reports",
  "/admin/users",
  "/admin/teams",
  "/admin/events",
  "/admin/reminders",
  "/admin/audit",
];

async function audit(page: Page, theme: "light" | "dark") {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    // Decorative blurred background layer.
    .exclude(".aurora")
    .analyze();
  return results.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => `[${theme}] ${v.id} (${v.impact}): ${v.help} → ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`);
}

test("main pages have no serious accessibility violations (light and dark)", async ({ browser }) => {
  test.setTimeout(300_000);
  const page = await signInAs(browser, ADMIN);
  const problems: string[] = [];
  for (const theme of ["light", "dark"] as const) {
    await page.evaluate((t) => localStorage.setItem("theme", t), theme);
    for (const path of PAGES) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      // Let entrance animations settle so contrast is measured on the final colours.
      await page.waitForTimeout(600);
      for (const p of await audit(page, theme)) problems.push(`${path} ${p}`);
    }
  }
  expect(problems, problems.join("\n")).toEqual([]);
});

test("the course player and results are accessible", async ({ browser }) => {
  const page = await signInAs(browser, ADMIN);
  await page.goto("/courses");
  const sample = page.getByRole("button", { name: "Add sample course" });
  if (await sample.isVisible()) {
    await sample.click();
    await page.waitForURL(/\/courses\/[0-9a-f-]{36}$/);
  } else {
    await page.getByRole("link", { name: /Cyber Security Essentials/ }).first().click();
  }
  await page.getByRole("button", { name: /Start course|Resume|Start again/ }).first().click();
  await page.waitForURL(/\/learn\//);
  const problems = await audit(page, "light");
  // Walk forward to the first question and audit that too.
  const next = page.getByRole("button", { name: /^Next/ });
  for (let i = 0; i < 6 && (await next.isVisible()) && (await next.isEnabled()); i++) await next.click();
  problems.push(...(await audit(page, "light")));
  expect(problems, problems.join("\n")).toEqual([]);
});

test("global search works from the keyboard", async ({ browser }) => {
  const page = await signInAs(browser, ADMIN);
  await page.goto("/");
  await page.keyboard.press("Control+k");
  const search = page.getByRole("combobox");
  await expect(search).toBeFocused();
  await search.fill("leader");
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/leaderboard/);
});
