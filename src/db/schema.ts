import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  timestamp,
  jsonb,
  index,
  primaryKey,
  boolean,
  uniqueIndex,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const roleEnum = pgEnum("role", ["learner", "manager", "author", "admin"]);
export type Role = (typeof roleEnum.enumValues)[number];

/** Avatar configuration: one selected item id per layer, plus colours. */
export type AvatarConfig = {
  skin: string;
  hair: string;
  hairColor: string;
  eyes: string;
  brows: string;
  mouth: string;
  top: string;
  topColor: string;
  accessory: string;
  background: string;
};

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Entra object id (oid claim). Null for local dev accounts. */
    entraOid: text("entra_oid").unique(),
    email: text("email").notNull().unique(),
    name: text("name").notNull(),
    department: text("department"),
    jobTitle: text("job_title"),
    role: roleEnum("role").notNull().default("learner"),
    /** Lifetime XP (drives level). */
    xp: integer("xp").notNull().default(0),
    /** Spendable points (shop currency). */
    coins: integer("coins").notNull().default(0),
    avatar: jsonb("avatar").$type<AvatarConfig>(),
    currentStreak: integer("current_streak").notNull().default(0),
    longestStreak: integer("longest_streak").notNull().default(0),
    /** YYYY-MM-DD in APP_TIMEZONE of the last day a course was completed */
    lastActiveDay: text("last_active_day"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    /** Admin-managed team (one per person). Null = not in a team yet. */
    teamId: uuid("team_id").references((): AnyPgColumn => teams.id, { onDelete: "set null" }),
  },
  (t) => [index("users_department_idx").on(t.department), index("users_team_idx").on(t.teamId)],
);

export type User = typeof users.$inferSelect;

// ---------------------------------------------------------------------------
// Teams (created by admins; leads manage their team's training)
// ---------------------------------------------------------------------------

export const teams = pgTable(
  "teams",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    icon: text("icon").notNull().default("👥"),
    /** Microsoft Teams incoming-webhook / Workflows URL for weekly team summaries. */
    webhookUrl: text("webhook_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("teams_name_unique").on(sql`lower(${t.name})`)],
);
export type Team = typeof teams.$inferSelect;

export const teamLeads = pgTable(
  "team_leads",
  {
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.teamId, t.userId] }), index("team_leads_user_idx").on(t.userId)],
);

// ---------------------------------------------------------------------------
// Courses & slides
// ---------------------------------------------------------------------------

export const courseStatusEnum = pgEnum("course_status", ["draft", "published", "archived"]);
export type CourseStatus = (typeof courseStatusEnum.enumValues)[number];

export const courses = pgTable(
  "courses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    category: text("category").notNull().default("General"),
    /** Slide theme key, see src/lib/themes.ts */
    theme: text("theme").notNull().default("aurora"),
    /** Emoji shown on the course card. */
    icon: text("icon").notNull().default("📘"),
    coverImage: text("cover_image"),
    estimatedMinutes: integer("estimated_minutes").notNull().default(10),
    /** Percentage required to pass (0-100). */
    passMark: integer("pass_mark").notNull().default(70),
    /** Null = unlimited attempts. */
    maxAttempts: integer("max_attempts"),
    /** Bonus XP for passing (on top of per-question points). */
    completionXp: integer("completion_xp").notNull().default(50),
    /** Question bank: each attempt draws this many random questions. Null = all. */
    drawQuestions: integer("draw_questions"),
    status: courseStatusEnum("status").notNull().default("draft"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
  },
  (t) => [index("courses_status_idx").on(t.status)],
);
export type Course = typeof courses.$inferSelect;

export type SlideLayout =
  | "title"
  | "content"
  | "image-left"
  | "image-right"
  | "image-full"
  | "video"
  | "audio"
  | "document"
  | "quote"
  | "section";

export type ChoiceOption = { id: string; text: string };

export type QuestionData =
  | {
      type: "single" | "multi";
      prompt: string;
      options: ChoiceOption[];
      correct: string[];
      explanation?: string;
      points?: number;
    }
  | {
      type: "truefalse";
      prompt: string;
      correct: boolean;
      explanation?: string;
      points?: number;
    }
  | {
      /** items are stored in the correct order */
      type: "ordering";
      prompt: string;
      items: ChoiceOption[];
      explanation?: string;
      points?: number;
    }
  | {
      type: "matching";
      prompt: string;
      pairs: { id: string; left: string; right: string }[];
      explanation?: string;
      points?: number;
    }
  | {
      /** Policy sign-off: the learner ticks a statement. Timestamped in attempt_answers. */
      type: "acknowledge";
      prompt: string;
      statement: string;
      explanation?: string;
      /** Defaults to 0 so it doesn't affect the score. */
      points?: number;
    };

export type QuestionType = QuestionData["type"];

export const slides = pgTable(
  "slides",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    kind: text("kind").$type<"content" | "question">().notNull().default("content"),
    layout: text("layout").$type<SlideLayout>().notNull().default("content"),
    title: text("title").notNull().default(""),
    /** Lightweight markdown */
    body: text("body").notNull().default(""),
    mediaUrl: text("media_url"),
    notes: text("notes"),
    question: jsonb("question").$type<QuestionData>(),
    /** Video/audio must be played to the end before moving on. */
    requireMedia: boolean("require_media").notNull().default(false),
  },
  (t) => [index("slides_course_idx").on(t.courseId, t.position)],
);
export type Slide = typeof slides.$inferSelect;

/** The slide fields frozen into a published version. */
export type VersionSlide = Pick<Slide, "id" | "position" | "kind" | "layout" | "title" | "body" | "mediaUrl" | "notes" | "question" | "requireMedia">;

/**
 * Every publish freezes the slides. Learners always take a published version,
 * so authors can keep editing the draft without changing live attempts.
 */
export const courseVersions = pgTable(
  "course_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    slides: jsonb("slides").$type<VersionSlide[]>().notNull(),
    note: text("note"),
    publishedBy: uuid("published_by").references(() => users.id, { onDelete: "set null" }),
    publishedAt: timestamp("published_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("course_versions_course_version").on(t.courseId, t.version)],
);
export type CourseVersion = typeof courseVersions.$inferSelect;

/** Learner feedback: one rating per person per course (editable). */
export const courseRatings = pgTable(
  "course_ratings",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    stars: integer("stars").notNull(),
    comment: text("comment"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.courseId] }), index("course_ratings_course_idx").on(t.courseId)],
);

// ---------------------------------------------------------------------------
// Attempts & answers
// ---------------------------------------------------------------------------

export const attempts = pgTable(
  "attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    currentSlide: integer("current_slide").notNull().default(0),
    /** Percentage 0-100 */
    score: integer("score"),
    correctCount: integer("correct_count"),
    questionCount: integer("question_count"),
    passed: boolean("passed"),
    xpEarned: integer("xp_earned").notNull().default(0),
    coinsEarned: integer("coins_earned").notNull().default(0),
    /** Published version being taken. Null for attempts from before versioning. */
    versionId: uuid("version_id").references((): AnyPgColumn => courseVersions.id, { onDelete: "set null" }),
    /** Question bank draw for this attempt. Null = every question. */
    questionIds: jsonb("question_ids").$type<string[]>(),
  },
  (t) => [index("attempts_user_course_idx").on(t.userId, t.courseId), index("attempts_course_idx").on(t.courseId)],
);
export type Attempt = typeof attempts.$inferSelect;

export type AnswerValue = string[] | boolean | Record<string, string>;

export const attemptAnswers = pgTable(
  "attempt_answers",
  {
    attemptId: uuid("attempt_id")
      .notNull()
      .references(() => attempts.id, { onDelete: "cascade" }),
    /** Slide id inside the attempt's version (no FK: drafts may delete the slide). */
    slideId: uuid("slide_id").notNull(),
    answer: jsonb("answer").$type<AnswerValue>().notNull(),
    correct: boolean("correct").notNull(),
    points: integer("points").notNull().default(0),
    answeredAt: timestamp("answered_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.attemptId, t.slideId] })],
);
export type AttemptAnswer = typeof attemptAnswers.$inferSelect;

// ---------------------------------------------------------------------------
// XP ledger (drives leaderboards by period)
// ---------------------------------------------------------------------------

export const xpEvents = pgTable(
  "xp_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    xp: integer("xp").notNull().default(0),
    coins: integer("coins").notNull().default(0),
    reason: text("reason").notNull(),
    refId: text("ref_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("xp_events_user_idx").on(t.userId, t.createdAt),
    index("xp_events_created_idx").on(t.createdAt),
    index("xp_events_ref_idx").on(t.refId),
  ],
);

// ---------------------------------------------------------------------------
// Gamification
// ---------------------------------------------------------------------------

export const userBadges = pgTable(
  "user_badges",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    badge: text("badge").notNull(),
    /** Attempt that triggered the badge, if any */
    refId: text("ref_id"),
    awardedAt: timestamp("awarded_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.badge] })],
);

export const userItems = pgTable(
  "user_items",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    item: text("item").notNull(),
    price: integer("price").notNull().default(0),
    purchasedAt: timestamp("purchased_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.item] })],
);

// ---------------------------------------------------------------------------
// Assignments
// ---------------------------------------------------------------------------

export const assignmentTargetEnum = pgEnum("assignment_target", ["user", "department", "everyone", "team"]);
export type AssignmentTarget = (typeof assignmentTargetEnum.enumValues)[number];

export const assignments = pgTable(
  "assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    targetType: assignmentTargetEnum("target_type").notNull(),
    /** Set when targetType = user */
    targetUserId: uuid("target_user_id").references(() => users.id, { onDelete: "cascade" }),
    /** Set when targetType = department */
    targetDepartment: text("target_department"),
    /** Set when targetType = team */
    targetTeamId: uuid("target_team_id").references(() => teams.id, { onDelete: "cascade" }),
    dueAt: timestamp("due_at", { withTimezone: true }),
    /** Recurring training: a pass is valid for this many months, then it must be retaken. */
    recurMonths: integer("recur_months"),
    note: text("note"),
    assignedBy: uuid("assigned_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("assignments_course_idx").on(t.courseId),
    index("assignments_user_idx").on(t.targetUserId),
    index("assignments_dept_idx").on(t.targetDepartment),
    index("assignments_team_idx").on(t.targetTeamId),
  ],
);
export type Assignment = typeof assignments.$inferSelect;

// ---------------------------------------------------------------------------
// Audit log (who changed what)
// ---------------------------------------------------------------------------

export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    /** Denormalised so entries stay readable after a user is removed. */
    actorName: text("actor_name"),
    /** e.g. "role.change", "course.publish", "assignment.create" */
    action: text("action").notNull(),
    targetType: text("target_type"),
    targetId: text("target_id"),
    summary: text("summary").notNull(),
    meta: jsonb("meta").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("audit_created_idx").on(t.createdAt), index("audit_action_idx").on(t.action, t.createdAt)],
);
export type AuditEntry = typeof auditLog.$inferSelect;

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** "reminder" | "nudge" | "summary" */
    kind: text("kind").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull().default(""),
    link: text("link"),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("notifications_user_idx").on(t.userId, t.createdAt)],
);
export type Notification = typeof notifications.$inferSelect;

/** Idempotency keys for outbound reminders, so each one goes out once. */
export const deliveryLog = pgTable("delivery_log", {
  key: text("key").primaryKey(),
  sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
});
