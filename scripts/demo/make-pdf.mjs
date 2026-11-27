// Builds docs/Feature-Tour.pdf from the screenshots in .data/shots.
// Usage: node scripts/demo/make-pdf.mjs [shotsDir] [out.pdf]
import { chromium } from "@playwright/test";
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";

const SHOTS = path.resolve(process.argv[2] ?? ".data/shots");
const OUT = path.resolve(process.argv[3] ?? "docs/Feature-Tour.pdf");

const CAPTIONS = {
  signin: ["Sign in", "Single sign-on with Microsoft Entra ID. People are created on first sign-in with their department from Entra."],
  dashboard: ["Learner dashboard", "Level, XP, streak and coins at a glance, what's due next, the live event banner and recent kudos."],
  "dashboard-dark": ["Dark mode", "Every page has a hand-tuned dark theme, checked for contrast."],
  courses: ["Course catalogue", "Search and filter by category, with ratings, duration, progress and due dates."],
  leaderboard: ["Leaderboard", "Week, month and all-time rankings with avatars and levels."],
  "leaderboard-teams": ["Team leaderboard", "Teams compete on average XP per person, plus the live team challenge."],
  badges: ["Badges", "Achievements for streaks, perfect scores, speed, comebacks, kudos and more."],
  kudos: ["Kudos", "Thank a colleague with coins and a message. Givers earn XP too; daily cap prevents abuse."],
  avatar: ["Avatar builder", "Hair, face, outfit, accessories and backgrounds, with rare items unlocked by badges."],
  shop: ["Shop", "Spend coins earned from learning on avatar items and backgrounds."],
  certificates: ["Certificates", "A branded PDF certificate for every passed course, downloadable any time."],
  team: ["Team progress", "Managers see who's done, overdue or not started in their team."],
  assignments: ["Assignments", "Assign courses to everyone, a team, a department or individuals, with due dates and yearly recurrence."],
  studio: ["Course studio", "Authors build courses from scratch or import a PowerPoint deck."],
  course: ["Course page", "Overview, outline, rating and your best score, with start, resume or retake."],
  "studio-editor": ["Slide editor", "Slide-by-slide editing with themes, layouts, media, PDF hand-outs and every question type."],
  "player-title": ["Course player", "Full-screen, PowerPoint-style slides with keyboard navigation and progress."],
  "player-content": ["Content slides", "Rich content slides with images, layouts and themes."],
  "player-question": ["Questions", "Multiple choice, select-all, true/false, ordering and matching, with points per question."],
  "player-feedback": ["Instant feedback", "Right or wrong straight away, with an explanation, points and a speed bonus."],
  "player-ordering": ["Put it in order", "Drag to reorder, or use the keyboard-friendly move buttons."],
  results: ["Results", "Score, XP, coins, level-up, event bonus and newly earned badges, with confetti."],
  "results-detail": ["Question breakdown", "Your answer against the correct answer, with the explanation for each question."],
  search: ["Global search", "Ctrl+K or / from anywhere to jump to courses, people, teams and pages."],
  reports: ["Reports", "Completions over time, compliance by team, course performance and the hardest questions."],
  "admin-users": ["People & roles", "Search people, change roles (admin, manager, author, learner) and teams."],
  "admin-teams": ["Teams", "Create teams, add members and set team leads."],
  "admin-events": ["Events", "Run seasonal events with XP multipliers and team challenges."],
  "admin-reminders": ["Reminders", "Automatic due and overdue reminders, weekly manager digests, Teams channel posts and nudges, all in the in-app bell too."],
  "admin-audit": ["Audit log", "Every admin action recorded: role changes, assignments, course edits."],
  "dashboard-fr": ["Languages", "English, French, German and Spanish, chosen automatically from the browser or picked by the user."],
  "mobile-dashboard": ["Mobile", "Fully responsive, and installable as an app (PWA) on phones and Windows."],
  "mobile-leaderboard": ["Mobile leaderboard", "Everything works on a phone, including the course player."],
};

const FEATURES = [
  ["Learning", [
    "PowerPoint-style course player with themes, layouts, images and video",
    "Five question types: multiple choice, select all, true/false, put in order, match the pairs",
    "Instant feedback with explanations, pass marks, retakes and resume where you left off",
    "PDF hand-outs that pop up inside a course for detailed reading before the questions",
    "Course ratings and reviews, PDF certificates for every pass",
  ]],
  ["Gamification", [
    "XP and levels with a level-up celebration, coins, daily streaks",
    "Speed bonus for quick correct answers, sound effects (mutable)",
    "Badges for milestones, perfect scores, streaks, comebacks and kudos",
    "Individual and team leaderboards (week / month / all time)",
    "Avatar builder and shop, with rare items unlocked by badges",
    "Seasonal events with double XP and team challenges, peer kudos with coins",
  ]],
  ["Authoring & admin", [
    "Course studio with slide editor and .pptx import",
    "Assignments to everyone, teams, departments or people, with due dates and yearly recurrence",
    "Teams with leads; roles for admins, managers, authors and learners",
    "Team progress for managers, reminder emails, audit log",
    "Reporting dashboard: completions, compliance, course performance, hardest questions",
  ]],
  ["Platform", [
    "Microsoft Entra ID single sign-on",
    "Next.js + PostgreSQL, containerised; Terraform module for Azure Container Apps",
    "Public release image on GitHub Container Registry",
    "Installable app (PWA) for Windows and phones, with offline page",
    "English, French, German and Spanish; light and dark themes",
    "Accessibility tested with axe (WCAG 2.1 AA) on every page, full keyboard support",
    "Global search (Ctrl+K), 77 unit/integration tests and an end-to-end suite in CI",
  ]],
];

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const files = JSON.parse(fs.readFileSync(path.join(SHOTS, "index.json"), "utf8"));

const pages = [];
for (const f of files) {
  const key = f.replace(/^\d+-/, "").replace(/\.png$/, "");
  const [title, text] = CAPTIONS[key] ?? [key, ""];
  const meta = await sharp(path.join(SHOTS, f)).metadata();
  const tall = meta.height / meta.width > 0.9;
  const mobile = meta.width < 1000;
  const img = await sharp(path.join(SHOTS, f))
    .resize({ width: mobile ? 700 : 1800, withoutEnlargement: true })
    .jpeg({ quality: 82 })
    .toBuffer();
  pages.push({ title, text, src: `data:image/jpeg;base64,${img.toString("base64")}`, tall, mobile });
}

// Pair the two mobile shots on one page.
const html = `<!doctype html><html><head><meta charset="utf-8"><style>
@page { size: A4 landscape; margin: 0; }
* { box-sizing: border-box; }
body { margin: 0; font-family: "Segoe UI", system-ui, sans-serif; color: #1c1633; }
.page { width: 297mm; height: 210mm; padding: 14mm 16mm; page-break-after: always; display: flex; flex-direction: column; background: #faf9ff; }
.cover { background: linear-gradient(135deg, #6d4aff 0%, #b14dff 55%, #ff5d8f 100%); color: white; justify-content: center; padding: 28mm; }
.cover h1 { font-size: 46pt; margin: 0 0 6mm; letter-spacing: -1px; }
.cover p { font-size: 16pt; opacity: .92; margin: 0 0 3mm; max-width: 200mm; }
.cover .small { font-size: 11pt; opacity: .8; margin-top: 12mm; }
h2 { font-size: 20pt; margin: 0 0 2mm; color: #4b2fd6; }
.cap { font-size: 11pt; color: #554d70; margin: 0 0 5mm; }
.shot { flex: 1; min-height: 0; display: flex; justify-content: center; align-items: flex-start; gap: 10mm; }
.shot img { max-width: 100%; max-height: 100%; object-fit: contain; border-radius: 3mm; box-shadow: 0 2mm 8mm rgba(60,30,140,.18); }
.features { display: grid; grid-template-columns: 1fr 1fr; gap: 9mm 14mm; margin-top: 4mm; }
.features h3 { color: #6d4aff; margin: 0 0 2mm; font-size: 16pt; }
.features ul { margin: 0; padding-left: 5mm; font-size: 12.5pt; line-height: 1.55; }
.num { position: absolute; }
</style></head><body>
<section class="page cover">
  <h1>ATT Training Platform</h1>
  <p>A gamified training platform for the whole company: PowerPoint-style courses with questions, assignments and certificates, wrapped in XP, levels, badges, leaderboards, avatars and events.</p>
  <p>Shown here as the "Contoso Academy" demo with sample people and courses.</p>
  <p class="small">Feature tour · ${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })} · github.com/sudo-rm-me/att-training-platform</p>
</section>
<section class="page">
  <h2>Feature list</h2>
  <p class="cap">Everything below is built, tested and merged.</p>
  <div class="features">${FEATURES.map(([h, items]) => `<div><h3>${esc(h)}</h3><ul>${items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul></div>`).join("")}</div>
</section>
${(() => {
  const out = [];
  for (let i = 0; i < pages.length; i++) {
    const p = pages[i];
    if (p.mobile && pages[i + 1]?.mobile) {
      const q = pages[i + 1];
      out.push(`<section class="page"><h2>${esc(p.title)}</h2><p class="cap">${esc(p.text)}</p><div class="shot"><img src="${p.src}"><img src="${q.src}"></div></section>`);
      i++;
      continue;
    }
    out.push(`<section class="page"><h2>${esc(p.title)}</h2><p class="cap">${esc(p.text)}</p><div class="shot"><img src="${p.src}"></div></section>`);
  }
  return out.join("\n");
})()}
</body></html>`;

const browser = await chromium.launch({ channel: process.env.CI ? undefined : "msedge" });
const page = await browser.newPage();
await page.setContent(html, { waitUntil: "load" });
fs.mkdirSync(path.dirname(OUT), { recursive: true });
await page.pdf({ path: OUT, format: "A4", landscape: true, printBackground: true, preferCSSPageSize: true });
await browser.close();
console.log(`wrote ${OUT} (${(fs.statSync(OUT).size / 1e6).toFixed(1)} MB, ${pages.length} screenshots)`);
