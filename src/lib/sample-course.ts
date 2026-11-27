import "server-only";
import { getDb } from "@/db";
import { courses, slides, type QuestionData, type SlideLayout } from "@/db/schema";

type SampleSlide = {
  kind?: "content" | "question";
  layout?: SlideLayout;
  title?: string;
  body?: string;
  mediaUrl?: string;
  question?: QuestionData;
};

const SLIDES: SampleSlide[] = [
  {
    layout: "title",
    title: "Cyber Security Essentials",
    body: "Ten minutes to spot the traps and keep our data safe. 🔐",
  },
  {
    layout: "content",
    title: "Why this matters",
    body: "Most security incidents start with a **person**, not a machine.\n\n- Phishing emails trick people into sharing passwords\n- Weak or reused passwords get guessed or leaked\n- Unlocked screens and shared links expose data\n\nThe good news: a few simple habits stop almost all of it.",
  },
  {
    layout: "section",
    title: "Spotting phishing",
    body: "Part 1 of 3",
  },
  {
    layout: "content",
    title: "Red flags 🚩",
    body: "- **Urgency**: \"Your account will be closed in 1 hour!\"\n- **Mismatched sender**: display name says IT, address says something else\n- **Unexpected attachments or links**: hover before you click\n- **Requests for credentials**: we will *never* ask for your password by email",
  },
  {
    kind: "question",
    title: "Quick check",
    question: {
      type: "single",
      prompt: "An email from \"IT Support\" asks you to confirm your password via a link. What should you do?",
      options: [
        { id: "a", text: "Click the link and confirm, it's from IT" },
        { id: "b", text: "Reply with your password instead" },
        { id: "c", text: "Report it as phishing and delete it" },
        { id: "d", text: "Forward it to your team to check" },
      ],
      correct: ["c"],
      explanation: "IT will never ask for your password. Use the Report button so the security team can block it for everyone.",
    },
  },
  {
    kind: "question",
    title: "Quick check",
    question: {
      type: "multi",
      prompt: "Which of these are common signs of a phishing email?",
      options: [
        { id: "a", text: "Pressure to act immediately" },
        { id: "b", text: "A sender address that doesn't match the name" },
        { id: "c", text: "Your manager's usual signature" },
        { id: "d", text: "An unexpected attachment" },
      ],
      correct: ["a", "b", "d"],
      explanation: "Urgency, mismatched senders and surprise attachments are classic phishing tactics.",
    },
  },
  {
    layout: "section",
    title: "Strong passwords",
    body: "Part 2 of 3",
  },
  {
    layout: "quote",
    title: "Security team",
    body: "A long passphrase you can remember beats a short password you have to write down.",
  },
  {
    kind: "question",
    title: "True or false?",
    question: {
      type: "truefalse",
      prompt: "It's fine to reuse your work password on a personal shopping site if it's a strong one.",
      correct: false,
      explanation: "If that site is breached, attackers will try the same password on your work account. Always use unique passwords.",
    },
  },
  {
    layout: "section",
    title: "Reporting incidents",
    body: "Part 3 of 3",
  },
  {
    kind: "question",
    title: "Put it in order",
    question: {
      type: "ordering",
      prompt: "You think you clicked a malicious link. Put these steps in the right order.",
      items: [
        { id: "1", text: "Disconnect from the network" },
        { id: "2", text: "Report it to the IT service desk" },
        { id: "3", text: "Change your password from a safe device" },
        { id: "4", text: "Watch for unusual account activity" },
      ],
      explanation: "Contain first, then report, then recover. Reporting quickly is never a problem: it helps!",
    },
  },
  {
    kind: "question",
    title: "Match them up",
    question: {
      type: "matching",
      prompt: "Match each threat to the best defence.",
      pairs: [
        { id: "p1", left: "Phishing email", right: "Report button" },
        { id: "p2", left: "Leaked password", right: "Multi-factor authentication" },
        { id: "p3", left: "Shoulder surfing", right: "Lock your screen" },
      ],
      explanation: "Each habit closes a different door. Together they make you a hard target.",
    },
  },
  {
    layout: "title",
    title: "You're a security champion! 🛡️",
    body: "Hit **Finish** to see your score and collect your XP.",
  },
];

export async function installSampleCourse(userId: string) {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const [course] = await tx
      .insert(courses)
      .values({
        title: "Cyber Security Essentials",
        description: "Spot phishing, build strong passwords and know what to do when something goes wrong.",
        category: "Compliance",
        icon: "🛡️",
        theme: "aurora",
        estimatedMinutes: 10,
        passMark: 70,
        completionXp: 50,
        status: "published",
        publishedAt: new Date(),
        createdBy: userId,
      })
      .returning();
    await tx.insert(slides).values(
      SLIDES.map((s, i) => ({
        courseId: course.id,
        position: i,
        kind: s.kind ?? "content",
        layout: s.layout ?? "content",
        title: s.title ?? "",
        body: s.body ?? "",
        mediaUrl: s.mediaUrl ?? null,
        question: s.question ?? null,
      })),
    );
    return course;
  });
}
