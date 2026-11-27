"use server";

import { revalidatePath } from "next/cache";
import { and, eq, gte, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { userItems, users, xpEvents, type AvatarConfig } from "@/db/schema";
import { requireUser } from "@/lib/session";
import { HAIR_COLORS, ITEM_BY_KEY, isUnlocked, SKIN_TONES, TOP_COLORS } from "@/lib/avatar";
import { levelFromXp } from "@/lib/levels";
import { awardBadges } from "@/lib/gamification";
import { BADGE_BY_KEY } from "@/lib/badges";

const hex = z.string().regex(/^#[0-9a-f]{6}$/i);
const configSchema = z.object({
  skin: hex,
  hair: z.string().max(32),
  hairColor: hex,
  eyes: z.string().max(32),
  brows: z.string().max(32),
  mouth: z.string().max(32),
  top: z.string().max(32),
  topColor: hex,
  accessory: z.string().max(32),
  background: z.string().max(32),
});

async function ownedItems(userId: string) {
  const db = await getDb();
  return new Set((await db.select({ i: userItems.item }).from(userItems).where(eq(userItems.userId, userId))).map((r) => r.i));
}

export async function saveAvatarAction(config: AvatarConfig) {
  const user = await requireUser();
  const c = configSchema.parse(config);
  if (!SKIN_TONES.includes(c.skin) || !HAIR_COLORS.includes(c.hairColor) || !TOP_COLORS.includes(c.topColor))
    return { ok: false as const, error: "Unknown colour" };

  const owned = await ownedItems(user.id);
  const level = levelFromXp(user.xp).level;
  for (const cat of ["hair", "eyes", "brows", "mouth", "top", "accessory", "background"] as const) {
    const it = ITEM_BY_KEY.get(`${cat}:${c[cat]}`);
    if (!it) return { ok: false as const, error: `Unknown ${cat}` };
    if (!isUnlocked(it, level, owned)) return { ok: false as const, error: `${it.label} is locked` };
  }

  const db = await getDb();
  await db.update(users).set({ avatar: c }).where(eq(users.id, user.id));
  const badges = await awardBadges(user.id);
  revalidatePath("/", "layout");
  return { ok: true as const, badges: badges.map((b) => b.name) };
}

export async function buyItemAction(itemKey: string) {
  const user = await requireUser();
  const it = ITEM_BY_KEY.get(z.string().max(64).parse(itemKey));
  if (!it || it.price <= 0) return { ok: false as const, error: "That item isn't for sale." };

  const db = await getDb();
  const result = await db.transaction(async (tx) => {
    const [already] = await tx
      .select()
      .from(userItems)
      .where(and(eq(userItems.userId, user.id), eq(userItems.item, it.key)));
    if (already) return { ok: false as const, error: "You already own this." };
    // Atomic spend: only succeeds if the balance covers the price.
    const [paid] = await tx
      .update(users)
      .set({ coins: sql`${users.coins} - ${it.price}` })
      .where(and(eq(users.id, user.id), gte(users.coins, it.price)))
      .returning({ coins: users.coins });
    if (!paid) return { ok: false as const, error: "Not enough coins yet. Complete more courses!" };
    await tx.insert(userItems).values({ userId: user.id, item: it.key, price: it.price });
    await tx.insert(xpEvents).values({ userId: user.id, xp: 0, coins: -it.price, reason: "shop", refId: it.key });
    return { ok: true as const, coins: paid.coins };
  });
  if (!result.ok) return result;

  const badges = await awardBadges(user.id);
  revalidatePath("/", "layout");
  return { ...result, badges: badges.map((b) => BADGE_BY_KEY.get(b.key)!.name) };
}
