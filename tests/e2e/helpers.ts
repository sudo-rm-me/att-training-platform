import { expect, type Browser, type Page } from "@playwright/test";

export type Persona = { email: string; name: string; department?: string };

export const ADMIN: Persona = { email: "admin@e2e.test", name: "Ada Admin", department: "Engineering" };
export const LEARNER: Persona = { email: "lee@e2e.test", name: "Lee Learner", department: "Sales" };
export const MANAGER: Persona = { email: "max@e2e.test", name: "Max Manager", department: "Engineering" };
export const TEAMMATE: Persona = { email: "tia@e2e.test", name: "Tia Teammate", department: "Engineering" };

/** Sign in with the local dev login and return a page in a fresh browser context. */
export async function signInAs(browser: Browser, p: Persona): Promise<Page> {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto("/signin");
  await page.locator("#name").fill(p.name);
  await page.locator("#email").fill(p.email);
  await page.locator("#department").fill(p.department ?? "");
  await page.getByRole("button", { name: "Continue as dev user" }).click();
  await page.waitForURL((u) => u.pathname === "/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(p.name.split(" ")[0]);
  return page;
}

/** The page redirected to the dashboard with the "no permission" banner. */
export async function expectDenied(page: Page, path: string) {
  await page.goto(path);
  await page.waitForURL((u) => u.pathname === "/" && u.searchParams.get("denied") === "1");
  await expect(page.getByText("You don't have permission to view that page.")).toBeVisible();
}

export async function expectAllowed(page: Page, path: string, heading: string | RegExp) {
  const res = await page.goto(path);
  expect(res?.status()).toBeLessThan(400);
  expect(new URL(page.url()).pathname).toBe(path);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(heading);
}
