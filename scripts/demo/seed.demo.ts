/**
 * Seeds a realistic demo database for screenshots (never the dev DB).
 * Run: npx vitest run --config scripts/demo/vitest.demo.mts
 */
import { test } from "vitest";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { assignments, attempts, events, teamLeads, teams, users, xpEvents, type AvatarConfig } from "@/db/schema";
import { installSampleCourse } from "@/lib/sample-course";
import { answerQuestion, attemptSlides, completeAttempt, saveProgress, startOrResumeAttempt } from "@/lib/attempts";
import { rateCourse } from "@/lib/ratings";
import { giveKudos } from "@/lib/kudos";
import { awardBadges } from "@/lib/gamification";
import { correctAnswer, wrongAnswer } from "../../tests/support/answers";

const DAY = 86_400_000;
const now = Date.now();

type Person = { name: string; email: string; dept: string; role?: "admin" | "manager" | "author" | "learner"; skill: number; avatar?: Partial<AvatarConfig> };

const PEOPLE: Person[] = [
  { name: "Ada Admin", email: "ada@contoso.test", dept: "Engineering", role: "admin", skill: 0.95, avatar: { hair: "bun", hairColor: "#c2462e", top: "jacket", topColor: "#6d4aff", accessory: "glasses", background: "galaxy", eyes: "happy" } },
  { name: "Marcus Lee", email: "marcus@contoso.test", dept: "Engineering", role: "manager", skill: 0.9, avatar: { hair: "short", top: "hoodie", topColor: "#22b5a0", accessory: "headphones", background: "ocean" } },
  { name: "Priya Shah", email: "priya@contoso.test", dept: "Engineering", skill: 1, avatar: { hair: "long", hairColor: "#2b2118", top: "labcoat", topColor: "#3b82f6", accessory: "earrings", background: "neon", eyes: "stars" } },
  { name: "Tom Becker", email: "tom@contoso.test", dept: "Engineering", skill: 0.75, avatar: { hair: "spiky", hairColor: "#e3b35c", top: "tshirt", topColor: "#ef4444", accessory: "cap", background: "sunset" } },
  { name: "Sofia Rossi", email: "sofia@contoso.test", dept: "Sales", role: "manager", skill: 0.85, avatar: { hair: "ponytail", hairColor: "#5a3a22", top: "shirt", topColor: "#ff5d8f", accessory: "flower", background: "peach" } },
  { name: "Jamal Carter", email: "jamal@contoso.test", dept: "Sales", skill: 0.8, avatar: { hair: "afro", hairColor: "#2b2118", top: "sweater", topColor: "#ffb547", accessory: "sunglasses", background: "gold", skin: "#6f4a31" } },
  { name: "Hannah Kim", email: "hannah@contoso.test", dept: "Sales", skill: 0.6, avatar: { hair: "bob", hairColor: "#2b2118", top: "hoodie", topColor: "#7c5cff", accessory: "beanie", background: "mint" } },
  { name: "Liam O'Brien", email: "liam@contoso.test", dept: "Finance", role: "author", skill: 0.9, avatar: { hair: "curly", hairColor: "#c2462e", top: "jacket", topColor: "#1f2937", accessory: "bowtie", background: "violet" } },
  { name: "Chloé Martin", email: "chloe@contoso.test", dept: "Finance", skill: 0.7, avatar: { hair: "long", hairColor: "#f2e2b8", top: "tshirt", topColor: "#22b5a0", accessory: "partyhat", background: "rainbow" } },
  { name: "Noah Fischer", email: "noah@contoso.test", dept: "People", skill: 0.65, avatar: { hair: "buzz", top: "hero", topColor: "#3b82f6", background: "sky" } },
  { name: "Grace Wanjiru", email: "grace@contoso.test", dept: "People", role: "manager", skill: 0.95, avatar: { hair: "bun", hairColor: "#2b2118", skin: "#a26a45", top: "royal", accessory: "crown", background: "forest" } },
  { name: "Oliver Smith", email: "oliver@contoso.test", dept: "People", skill: 0.5, avatar: { hair: "mohawk", hairColor: "#ff6fb1", top: "tshirt", topColor: "#f5f5f5", background: "sunset" } },
];

const COURSES = [
  { title: "Cyber Security Essentials", icon: "🛡️", category: "Compliance", theme: "aurora", minutes: 10 },
  { title: "Fire Safety Basics", icon: "🧯", category: "Health & Safety", theme: "sunset", minutes: 8, description: "Know the alarms, the exits and what to do in the first two minutes of a fire." },
  { title: "Data Protection & GDPR", icon: "🔐", category: "Compliance", theme: "ocean", minutes: 15, description: "Handle personal data lawfully, spot a breach and report it within 72 hours." },
  { title: "Anti-Bribery & Gifts Policy", icon: "⚖️", category: "Policy", theme: "midnight", minutes: 12, description: "Where the line is on gifts, hospitality and conflicts of interest." },
  { title: "Welcome to Contoso", icon: "👋", category: "Onboarding", theme: "forest", minutes: 6, description: "Our story, values and the tools you'll use every day." },
  { title: "Giving Great Feedback", icon: "💬", category: "Leadership", theme: "paper", minutes: 9, description: "Kind, specific and useful feedback in five simple steps." },
];

test("seed demo data", { timeout: 600_000 }, async () => {
  const db = await getDb();

  // People
  const ids: Record<string, string> = {};
  for (const p of PEOPLE) {
    const [u] = await db
      .insert(users)
      .values({
        name: p.name,
        email: p.email,
        department: p.dept,
        role: p.role ?? "learner",
        jobTitle: p.role === "manager" ? "Team Lead" : null,
        avatar: p.avatar
          ? ({ skin: "#e8b08a", hair: "short", hairColor: "#5a3a22", eyes: "normal", brows: "natural", mouth: "smile", top: "tshirt", topColor: "#6d4aff", accessory: "none", background: "violet", ...p.avatar } as AvatarConfig)
          : null,
      })
      .returning();
    ids[p.email] = u.id;
  }
  const admin = ids["ada@contoso.test"];

  // Teams + leads
  const teamIcons: Record<string, string> = { Engineering: "🛠️", Sales: "💼", Finance: "📊", People: "🌱" };
  const teamId: Record<string, string> = {};
  for (const [name, icon] of Object.entries(teamIcons)) {
    const [t] = await db.insert(teams).values({ name, icon, description: `${name} department` }).returning();
    teamId[name] = t.id;
  }
  for (const p of PEOPLE) await db.update(users).set({ teamId: teamId[p.dept] }).where(eq(users.id, ids[p.email]));
  for (const [email, dept] of [["marcus@contoso.test", "Engineering"], ["sofia@contoso.test", "Sales"], ["grace@contoso.test", "People"], ["liam@contoso.test", "Finance"]])
    await db.insert(teamLeads).values({ teamId: teamId[dept], userId: ids[email] });

  // Courses
  const courseIds: string[] = [];
  for (const c of COURSES) {
    const course = await installSampleCourse(admin);
    const { courses } = await import("@/db/schema");
    await db
      .update(courses)
      .set({
        title: c.title,
        icon: c.icon,
        category: c.category,
        theme: c.theme,
        estimatedMinutes: c.minutes,
        ...(c.description ? { description: c.description } : {}),
        publishedAt: new Date(now - 90 * DAY),
      })
      .where(eq(courses.id, course.id));
    courseIds.push(course.id);
  }

  // Assignments: org-wide compliance, recurring yearly; onboarding for People team.
  await db.insert(assignments).values([
    { courseId: courseIds[0], targetType: "everyone", dueAt: new Date(now + 9 * DAY), recurMonths: 12, assignedBy: admin, note: "Annual security refresher" },
    { courseId: courseIds[2], targetType: "everyone", dueAt: new Date(now - 3 * DAY), recurMonths: 12, assignedBy: admin },
    { courseId: courseIds[1], targetType: "team", targetTeamId: teamId.Engineering, dueAt: new Date(now + 20 * DAY), assignedBy: ids["marcus@contoso.test"] },
    { courseId: courseIds[3], targetType: "team", targetTeamId: teamId.Sales, dueAt: new Date(now + 4 * DAY), assignedBy: ids["sofia@contoso.test"] },
  ]);

  // Learning history spread over ~10 weeks.
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (const [pi, p] of PEOPLE.entries()) {
    const uid = ids[p.email];
    const howMany = Math.max(2, Math.round(COURSES.length * p.skill));
    for (let ci = 0; ci < howMany; ci++) {
      const courseId = courseIds[(ci + pi) % courseIds.length];
      // Skip the overdue GDPR course for a few people so compliance isn't perfect.
      if (courseId === courseIds[2] && p.skill < 0.7) continue;
      const a = await startOrResumeAttempt(uid, courseId, { restart: true });
      const list = await attemptSlides(a);
      for (let i = 0; i < list.length; i++) {
        const s = list[i];
        if (!s.question) continue;
        await saveProgress(a.id, uid, i);
        const right = rnd() < p.skill + 0.05;
        await answerQuestion(a.id, uid, s.id, right ? correctAnswer(s.question) : wrongAnswer(s.question));
      }
      await completeAttempt(a.id, uid);
      const when = new Date(now - Math.floor(rnd() * 68 + 1) * DAY - Math.floor(rnd() * 8) * 3_600_000);
      await db.update(attempts).set({ startedAt: new Date(when.getTime() - 9 * 60_000), completedAt: when }).where(eq(attempts.id, a.id));
      await db.update(xpEvents).set({ createdAt: when }).where(eq(xpEvents.refId, a.id));
      if (rnd() < 0.7) await rateCourse(uid, courseId, rnd() < 0.6 ? 5 : 4, rnd() < 0.4 ? "Clear and quick, the quiz made it stick." : null);
    }
    await db.update(users).set({ currentStreak: Math.round(p.skill * 9), longestStreak: Math.round(p.skill * 14), lastActiveDay: new Date().toISOString().slice(0, 10) }).where(eq(users.id, uid));
  }

  // Seasonal event running now.
  await db.insert(events).values({
    name: "Cyber Security Month",
    description: "Double XP on every course while it lasts. Which team will top the board?",
    emoji: "🔒",
    startsAt: new Date(now - 6 * DAY),
    endsAt: new Date(now + 2 * DAY + 5 * 3_600_000),
    xpMultiplier: 200,
    teamChallenge: true,
    createdBy: admin,
  });

  // Kudos
  const k: [string, string, number, string][] = [
    ["marcus@contoso.test", "priya@contoso.test", 25, "Thanks for pairing on the incident review, you spotted the root cause in minutes!"],
    ["sofia@contoso.test", "jamal@contoso.test", 10, "Brilliant demo for the Fabrikam team today."],
    ["grace@contoso.test", "noah@contoso.test", 10, "The new starter pack is so much clearer. Thank you!"],
    ["priya@contoso.test", "tom@contoso.test", 5, "Cheers for reviewing my PR so quickly."],
    ["liam@contoso.test", "chloe@contoso.test", 25, "Month-end close went perfectly, great work."],
    ["jamal@contoso.test", "hannah@contoso.test", 10, "Thanks for covering my calls on Friday."],
    ["ada@contoso.test", "grace@contoso.test", 50, "For organising Cyber Security Month 🎉"],
  ];
  for (const [from, to, coins, msg] of k) {
    await db.update(users).set({ coins: 500 }).where(eq(users.id, ids[from]));
    await giveKudos(ids[from], ids[to], coins, msg);
  }
  // Leave Ada with coins to show the shop/topbar.
  await db.update(users).set({ coins: 640 }).where(eq(users.id, admin));
  for (const id of Object.values(ids)) await awardBadges(id);
  console.log("seeded", Object.keys(ids).length, "people,", courseIds.length, "courses");
});
