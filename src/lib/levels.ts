/** XP needed to *reach* level n (n >= 1). Gentle quadratic curve. */
export function xpForLevel(level: number) {
  if (level <= 1) return 0;
  return Math.round(50 * (level - 1) * (level - 1) + 100 * (level - 1));
}

export function levelFromXp(xp: number) {
  let level = 1;
  while (xpForLevel(level + 1) <= xp) level++;
  const floor = xpForLevel(level);
  const next = xpForLevel(level + 1);
  return {
    level,
    xpIntoLevel: xp - floor,
    xpForNext: next - floor,
    progress: (xp - floor) / (next - floor),
    title: levelTitle(level),
  };
}

const TITLES = [
  "Rookie",
  "Apprentice",
  "Explorer",
  "Achiever",
  "Specialist",
  "Expert",
  "Mentor",
  "Master",
  "Champion",
  "Legend",
];

export function levelTitle(level: number) {
  return TITLES[Math.min(TITLES.length - 1, Math.floor((level - 1) / 3))];
}
