/** Badge catalogue (pure, usable on client and server). */

export type BadgeStats = {
  passedCourses: number;
  perfectCourses: number;
  currentStreak: number;
  longestStreak: number;
  level: number;
  itemsBought: number;
  avatarCustomised: boolean;
  kudosSent?: number;
  kudosReceived?: number;
  /** Facts about the attempt that just finished (if any). */
  last?: {
    passed: boolean;
    score: number;
    hour: number;
    durationSec: number;
    estimatedMinutes: number;
    previouslyFailed: boolean;
  };
};

export type BadgeDef = {
  key: string;
  name: string;
  description: string;
  emoji: string;
  /** Tailwind-friendly gradient stops */
  colors: [string, string];
  xp: number;
  earned: (s: BadgeStats) => boolean;
  progress?: (s: BadgeStats) => [number, number];
};

export const BADGES: BadgeDef[] = [
  {
    key: "first_steps",
    name: "First Steps",
    description: "Pass your first course.",
    emoji: "👣",
    colors: ["#a78bfa", "#6d4aff"],
    xp: 20,
    earned: (s) => s.passedCourses >= 1,
    progress: (s) => [Math.min(1, s.passedCourses), 1],
  },
  {
    key: "hat_trick",
    name: "Hat Trick",
    description: "Pass 3 courses.",
    emoji: "🎩",
    colors: ["#f9a8d4", "#db2777"],
    xp: 30,
    earned: (s) => s.passedCourses >= 3,
    progress: (s) => [Math.min(3, s.passedCourses), 3],
  },
  {
    key: "scholar",
    name: "Scholar",
    description: "Pass 10 courses.",
    emoji: "🎓",
    colors: ["#93c5fd", "#1d4ed8"],
    xp: 75,
    earned: (s) => s.passedCourses >= 10,
    progress: (s) => [Math.min(10, s.passedCourses), 10],
  },
  {
    key: "perfectionist",
    name: "Perfectionist",
    description: "Score 100% on a course.",
    emoji: "💯",
    colors: ["#fde68a", "#f59e0b"],
    xp: 30,
    earned: (s) => s.perfectCourses >= 1,
    progress: (s) => [Math.min(1, s.perfectCourses), 1],
  },
  {
    key: "flawless_five",
    name: "Flawless Five",
    description: "Score 100% on 5 different courses.",
    emoji: "🌟",
    colors: ["#fef08a", "#ca8a04"],
    xp: 80,
    earned: (s) => s.perfectCourses >= 5,
    progress: (s) => [Math.min(5, s.perfectCourses), 5],
  },
  {
    key: "on_fire",
    name: "On Fire",
    description: "Learn 3 days in a row.",
    emoji: "🔥",
    colors: ["#fdba74", "#ea580c"],
    xp: 25,
    earned: (s) => s.longestStreak >= 3,
    progress: (s) => [Math.min(3, s.longestStreak), 3],
  },
  {
    key: "unstoppable",
    name: "Unstoppable",
    description: "Learn 7 days in a row.",
    emoji: "⚡",
    colors: ["#fcd34d", "#d97706"],
    xp: 60,
    earned: (s) => s.longestStreak >= 7,
    progress: (s) => [Math.min(7, s.longestStreak), 7],
  },
  {
    key: "rising_star",
    name: "Rising Star",
    description: "Reach level 5.",
    emoji: "⭐",
    colors: ["#c4b5fd", "#7c3aed"],
    xp: 40,
    earned: (s) => s.level >= 5,
    progress: (s) => [Math.min(5, s.level), 5],
  },
  {
    key: "legend",
    name: "Living Legend",
    description: "Reach level 10.",
    emoji: "👑",
    colors: ["#fde68a", "#b45309"],
    xp: 100,
    earned: (s) => s.level >= 10,
    progress: (s) => [Math.min(10, s.level), 10],
  },
  {
    key: "comeback",
    name: "Comeback Kid",
    description: "Pass a course you previously didn't.",
    emoji: "💪",
    colors: ["#86efac", "#16a34a"],
    xp: 25,
    earned: (s) => Boolean(s.last?.passed && s.last.previouslyFailed),
  },
  {
    key: "early_bird",
    name: "Early Bird",
    description: "Finish a course before 8am.",
    emoji: "🌅",
    colors: ["#fecaca", "#f97316"],
    xp: 15,
    earned: (s) => Boolean(s.last && s.last.hour < 8),
  },
  {
    key: "night_owl",
    name: "Night Owl",
    description: "Finish a course after 9pm.",
    emoji: "🦉",
    colors: ["#a5b4fc", "#312e81"],
    xp: 15,
    earned: (s) => Boolean(s.last && s.last.hour >= 21),
  },
  {
    key: "speed_runner",
    name: "Speed Runner",
    description: "Pass a course in under half its estimated time.",
    emoji: "🏃",
    colors: ["#67e8f9", "#0891b2"],
    xp: 20,
    earned: (s) => Boolean(s.last?.passed && s.last.durationSec < s.last.estimatedMinutes * 30),
  },
  {
    key: "new_look",
    name: "New Look",
    description: "Customise your avatar.",
    emoji: "🪞",
    colors: ["#f0abfc", "#a21caf"],
    xp: 10,
    earned: (s) => s.avatarCustomised,
  },
  {
    key: "shopaholic",
    name: "Shopaholic",
    description: "Buy 3 items from the shop.",
    emoji: "🛍️",
    colors: ["#fbcfe8", "#be185d"],
    xp: 25,
    earned: (s) => s.itemsBought >= 3,
    progress: (s) => [Math.min(3, s.itemsBought), 3],
  },
  {
    key: "cheerleader",
    name: "Cheerleader",
    description: "Send 5 kudos to colleagues.",
    emoji: "📣",
    colors: ["#fde68a", "#d97706"],
    xp: 20,
    earned: (s) => (s.kudosSent ?? 0) >= 5,
    progress: (s) => [Math.min(5, s.kudosSent ?? 0), 5],
  },
  {
    key: "appreciated",
    name: "Appreciated",
    description: "Receive 5 kudos from colleagues.",
    emoji: "💖",
    colors: ["#fecdd3", "#e11d48"],
    xp: 25,
    earned: (s) => (s.kudosReceived ?? 0) >= 5,
    progress: (s) => [Math.min(5, s.kudosReceived ?? 0), 5],
  },
];

export const BADGE_BY_KEY = new Map(BADGES.map((b) => [b.key, b]));
