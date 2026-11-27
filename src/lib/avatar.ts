import type { AvatarConfig } from "@/db/schema";

export type AvatarCategory = "hair" | "eyes" | "brows" | "mouth" | "top" | "accessory" | "background";

export type AvatarItem = {
  /** unique key, "<category>:<value>" */
  key: string;
  category: AvatarCategory;
  value: string;
  label: string;
  /** Coin price in the shop (0 = free) */
  price: number;
  /** Unlocks for free at this level */
  minLevel?: number;
  /** Rare item: unlocks when this badge is earned */
  badge?: string;
};

const item = (category: AvatarCategory, value: string, label: string, price = 0, minLevel?: number): AvatarItem => ({
  key: `${category}:${value}`,
  category,
  value,
  label,
  price,
  minLevel,
});

const rare = (category: AvatarCategory, value: string, label: string, badge: string): AvatarItem => ({
  ...item(category, value, label),
  badge,
});

export const AVATAR_ITEMS: AvatarItem[] = [
  // Hair
  item("hair", "short", "Short"),
  item("hair", "long", "Long"),
  item("hair", "bob", "Bob"),
  item("hair", "bun", "Top bun"),
  item("hair", "curly", "Curly"),
  item("hair", "buzz", "Buzz cut"),
  item("hair", "none", "Bald"),
  item("hair", "mohawk", "Mohawk", 120),
  item("hair", "spiky", "Spiky", 150),
  item("hair", "ponytail", "Ponytail"),
  item("hair", "afro", "Afro", 180),
  // Eyes
  item("eyes", "normal", "Bright"),
  item("eyes", "happy", "Happy"),
  item("eyes", "wink", "Wink"),
  item("eyes", "sleepy", "Sleepy"),
  item("eyes", "surprised", "Surprised"),
  item("eyes", "hearts", "Heart eyes", 200),
  item("eyes", "stars", "Star eyes", 0, 8),
  // Brows
  item("brows", "natural", "Natural"),
  item("brows", "raised", "Raised"),
  item("brows", "focused", "Focused"),
  item("brows", "none", "None"),
  // Mouth
  item("mouth", "smile", "Smile"),
  item("mouth", "grin", "Grin"),
  item("mouth", "open", "Excited"),
  item("mouth", "neutral", "Neutral"),
  item("mouth", "smirk", "Smirk"),
  item("mouth", "tongue", "Cheeky", 100),
  // Tops
  item("top", "tshirt", "T-shirt"),
  item("top", "hoodie", "Hoodie"),
  item("top", "shirt", "Shirt & tie"),
  item("top", "sweater", "Sweater"),
  item("top", "jacket", "Blazer", 250),
  item("top", "hero", "Hero suit", 500),
  item("top", "royal", "Royal robe", 0, 15),
  item("top", "labcoat", "Lab coat", 300),
  rare("top", "astronaut", "Astronaut suit", "unstoppable"),
  // Accessories
  item("accessory", "none", "None"),
  item("accessory", "glasses", "Glasses"),
  item("accessory", "earrings", "Earrings"),
  item("accessory", "bowtie", "Bow tie", 80),
  item("accessory", "sunglasses", "Sunglasses", 150),
  item("accessory", "headphones", "Headphones", 200),
  item("accessory", "cap", "Cap", 120),
  item("accessory", "crown", "Crown", 0, 10),
  item("accessory", "halo", "Halo", 400),
  item("accessory", "partyhat", "Party hat", 60),
  item("accessory", "flower", "Flower", 90),
  item("accessory", "beanie", "Beanie", 100),
  rare("accessory", "wizard", "Wizard hat", "scholar"),
  rare("accessory", "laurel", "Laurel wreath", "flawless_five"),
  // Backgrounds
  item("background", "violet", "Violet"),
  item("background", "ocean", "Ocean"),
  item("background", "mint", "Mint"),
  item("background", "peach", "Peach"),
  item("background", "sky", "Sky"),
  item("background", "sunset", "Sunset", 60),
  item("background", "galaxy", "Galaxy", 300),
  item("background", "gold", "Gold", 0, 5),
  item("background", "rainbow", "Rainbow", 0, 12),
  item("background", "forest", "Forest", 120),
  item("background", "neon", "Neon", 200),
  rare("background", "aurora", "Aurora", "appreciated"),
];

export const ITEM_BY_KEY = new Map(AVATAR_ITEMS.map((i) => [i.key, i]));

export const SKIN_TONES = ["#ffe0c7", "#f8cba6", "#e8b08a", "#c98e64", "#a26a45", "#6f4a31"];
export const HAIR_COLORS = ["#2b2118", "#5a3a22", "#a0673a", "#e3b35c", "#f2e2b8", "#c2462e", "#8b8b97", "#7c5cff", "#ff6fb1", "#2fb5a8"];
export const TOP_COLORS = ["#6d4aff", "#ff5d8f", "#22b5a0", "#ffb547", "#3b82f6", "#1f2937", "#ef4444", "#f5f5f5"];

export const BACKGROUNDS: Record<string, [string, string] | "galaxy" | "rainbow" | "aurora"> = {
  violet: ["#a78bfa", "#6d4aff"],
  ocean: ["#67e8f9", "#2563eb"],
  mint: ["#bbf7d0", "#34d399"],
  peach: ["#fed7aa", "#fb7185"],
  sky: ["#e0f2fe", "#7dd3fc"],
  sunset: ["#fde68a", "#f43f5e"],
  gold: ["#fef08a", "#d97706"],
  forest: ["#86efac", "#166534"],
  neon: ["#f0abfc", "#0891b2"],
  aurora: "aurora",
  galaxy: "galaxy",
  rainbow: "rainbow",
};

export const DEFAULT_AVATAR: AvatarConfig = {
  skin: SKIN_TONES[1],
  hair: "short",
  hairColor: HAIR_COLORS[1],
  eyes: "normal",
  brows: "natural",
  mouth: "smile",
  top: "tshirt",
  topColor: TOP_COLORS[0],
  accessory: "none",
  background: "violet",
};

/** Deterministic starter avatar so everyone looks different before customising. */
export function starterAvatar(seed: string): AvatarConfig {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const pick = <T,>(arr: T[], salt: number) => arr[(h >>> salt) % arr.length];
  const free = (cat: AvatarCategory) =>
    AVATAR_ITEMS.filter((i) => i.category === cat && i.price === 0 && !i.minLevel && !i.badge).map((i) => i.value);
  return {
    skin: pick(SKIN_TONES, 1),
    hair: pick(free("hair").filter((v) => v !== "none"), 3),
    hairColor: pick(HAIR_COLORS.slice(0, 6), 5),
    eyes: "normal",
    brows: "natural",
    mouth: pick(["smile", "grin"], 7),
    top: pick(free("top"), 9),
    topColor: pick(TOP_COLORS, 11),
    accessory: "none",
    background: pick(free("background"), 13),
  };
}

export const CATEGORY_LABELS: Record<AvatarCategory, string> = {
  hair: "Hair",
  eyes: "Eyes",
  brows: "Brows",
  mouth: "Mouth",
  top: "Outfit",
  accessory: "Extras",
  background: "Background",
};

/** Item keys unlocked by the badges a user holds. */
export function badgeItemKeys(badges: Iterable<string>) {
  const have = new Set(badges);
  return AVATAR_ITEMS.filter((i) => i.badge && have.has(i.badge)).map((i) => i.key);
}

/** Whether the user may wear an item (free, level-unlocked, purchased or badge reward). */
export function isUnlocked(it: AvatarItem, level: number, owned: Set<string>) {
  if (owned.has(it.key)) return true;
  if (it.badge) return false;
  if (it.minLevel != null) return level >= it.minLevel;
  return it.price === 0;
}
