// Captures the feature-tour screenshots from the demo server (node scripts/demo/serve.mjs).
// Usage: node scripts/demo/screenshots.mjs [outDir]
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const BASE = "http://localhost:3200";
const OUT = path.resolve(process.argv[2] ?? ".data/shots");
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ channel: process.env.CI ? undefined : "msedge" });
const shots = [];

async function newPage(opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.5, ...opts });
  return ctx.newPage();
}

async function signIn(page, name, email, dept) {
  await page.goto(`${BASE}/signin`);
  await page.locator("#name").fill(name);
  await page.locator("#email").fill(email);
  await page.locator("#department").fill(dept);
  await page.getByRole("button", { name: "Continue as dev user" }).click();
  await page.waitForURL((u) => u.pathname === "/");
}

async function setTheme(page, theme) {
  await page.evaluate((t) => localStorage.setItem("theme", t), theme);
}

async function shot(page, name, { full = false, settle = 900 } = {}) {
  await page.waitForLoadState("networkidle").catch(() => {});
  // Hide the Next.js dev-mode badge.
  await page.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => {});
  await page.waitForTimeout(settle);
  const file = path.join(OUT, `${String(shots.length + 1).padStart(2, "0")}-${name}.png`);
  await page.screenshot({ path: file, fullPage: full });
  shots.push(file);
  console.log("📸", path.basename(file));
}

async function go(page, url, name, opts) {
  await page.goto(`${BASE}${url}`);
  await shot(page, name, opts);
}

// --- Signed out
{
  const p = await newPage();
  await p.goto(`${BASE}/signin`);
  await shot(p, "signin");
  await p.context().close();
}

// --- Admin tour (light)
const page = await newPage();
await signIn(page, "Ada Admin", "ada@contoso.test", "Engineering");
await setTheme(page, "light");
await go(page, "/", "dashboard");
await setTheme(page, "dark");
await go(page, "/", "dashboard-dark");
await go(page, "/courses", "courses");
await go(page, "/leaderboard", "leaderboard");
await go(page, "/leaderboard?view=teams&period=month", "leaderboard-teams");
await go(page, "/badges", "badges");
await go(page, "/kudos", "kudos");
await go(page, "/avatar", "avatar");
await go(page, "/shop", "shop");
await setTheme(page, "light");
await go(page, "/certificates", "certificates");
await go(page, "/team", "team");
await go(page, "/assignments", "assignments");
await go(page, "/studio", "studio");

// Course page + player
await page.goto(`${BASE}/courses`);
await page.getByRole("link", { name: /Fire Safety Basics/ }).first().click();
await page.waitForURL(/\/courses\/[0-9a-f-]{36}$/);
const coursePath = new URL(page.url()).pathname;
await shot(page, "course");
const courseId = coursePath.split("/").pop();

await page.goto(`${BASE}/studio/${courseId}`);
await shot(page, "studio-editor");

// Take a fresh course as a learner (with sound and a speed bonus).
const learner = await newPage();
await signIn(learner, "Oliver Smith", "oliver@contoso.test", "People");
await setTheme(learner, "light");
{
const page = learner;
await page.goto(`${BASE}/courses`);
await page.getByRole("link", { name: /Welcome to Contoso/ }).first().click();
await page.waitForURL(/\/courses\/[0-9a-f-]{36}$/);
await page.getByRole("button", { name: /Start course|Resume|Start again/ }).first().click();
await page.waitForURL(/\/learn\/[0-9a-f-]{36}$/);
await shot(page, "player-title");
const footer = page.locator("footer button").last();
const check = page.getByRole("button", { name: "Check answer" });
const choices = page.locator("main button:not([aria-label])").filter({ hasNotText: /Check answer/ });
let shotQuestion = false;
let shotOrdering = false;
// Correct answers for the sample course, so the demo run passes.
const PICK = ["Report it as phishing and delete it", "Pressure to act immediately", "A sender address that doesn't match the name", "An unexpected attachment", "False"];
const ORDER = ["Disconnect from the network", "Report it to the IT service desk", "Change your password from a safe device", "Watch for unusual account activity"];
const PAIRS = [["Phishing email", "Report button"], ["Leaked password", "Multi-factor authentication"], ["Shoulder surfing", "Lock your screen"]];
const btn = (name) => page.locator("main button").filter({ hasText: name }).first();
async function answerCurrent() {
  if (await page.getByLabel("Drag to reorder").count()) {
    for (const item of [...ORDER].reverse())
      for (let i = 0; i < ORDER.length; i++) {
        const up = page.getByRole("button", { name: `Move "${item}" up` });
        if (!(await up.isEnabled().catch(() => false))) break;
        await up.click({ timeout: 1500 }).catch(() => {});
      }
  } else if ((await page.getByText("Tap an item on the left").count()) > 0) {
    for (const [l, r] of PAIRS) {
      await btn(l).click({ timeout: 2000 }).catch(() => {});
      await btn(r).click({ timeout: 2000 }).catch(() => {});
    }
  } else {
    for (const t of PICK) if (await page.locator("main button").filter({ hasText: t }).count()) await btn(t).click();
  }
  if (!(await check.isEnabled())) {
    const ack = page.locator("main label").first();
    if (await ack.isVisible().catch(() => false)) await ack.click();
  }
  if (!(await check.isEnabled()) && (await choices.count())) await choices.first().click();
  if (await check.isEnabled()) await check.click();
}
for (let guard = 0; guard < 40; guard++) {
  const label = (await footer.innerText()).trim();
  if (/Finish/.test(label) && (await footer.isEnabled())) {
    await footer.click();
    break;
  }
  if (/^Next/.test(label)) {
    await footer.click();
    await page.waitForTimeout(450);
    if (guard === 0) await shot(page, "player-content");
    continue;
  }
  // A question is waiting.
  if (!shotQuestion) {
    await shot(page, "player-question");
  }
  const ordering = await page.getByLabel("Drag to reorder").count();
  if (ordering && !shotOrdering) {
    shotOrdering = true;
    await shot(page, "player-ordering");
  }
  await answerCurrent();
  await page.waitForTimeout(700);
  if (!shotQuestion) {
    shotQuestion = true;
    await shot(page, "player-feedback");
  }
}
await page.waitForURL(/\/results$/, { timeout: 30_000 }).catch(() => {});
await page.waitForTimeout(2500);
await shot(page, "results", { settle: 400 });
await page.keyboard.press("Escape");
await page.waitForTimeout(500);
await shot(page, "results-detail", { full: true, settle: 300 });
await page.context().close();
}

// Search palette
await page.goto(`${BASE}/`);
await page.waitForTimeout(800);
await page.keyboard.press("Control+k");
await page.keyboard.type("secur");
await page.waitForTimeout(900);
await shot(page, "search", { settle: 300 });
await page.keyboard.press("Escape");

// Admin pages
await go(page, "/admin/reports", "reports", { full: true });
await go(page, "/admin/users", "admin-users");
await go(page, "/admin/teams", "admin-teams");
await go(page, "/admin/events", "admin-events");
await go(page, "/admin/reminders", "admin-reminders");
await go(page, "/admin/audit", "admin-audit");

// Certificate PDF
await page.goto(`${BASE}/certificates`);

// French UI
await page.context().addCookies([{ name: "lang", value: "fr", url: BASE }]);
await go(page, "/", "dashboard-fr");
await page.context().clearCookies({ name: "lang" });
await page.context().close();

// Mobile
{
  const m = await newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await signIn(m, "Priya Shah", "priya@contoso.test", "Engineering");
  await setTheme(m, "dark");
  await go(m, "/", "mobile-dashboard");
  await go(m, "/leaderboard", "mobile-leaderboard");
  await m.context().close();
}

await browser.close();
fs.writeFileSync(path.join(OUT, "index.json"), JSON.stringify(shots.map((s) => path.basename(s)), null, 2));
console.log(`done: ${shots.length} screenshots in ${OUT}`);
