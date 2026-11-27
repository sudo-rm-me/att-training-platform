import "server-only";
import { aliasedTable, and, desc, eq, gte, sql, sum } from "drizzle-orm";
import { getDb } from "@/db";
import { kudos, users } from "@/db/schema";
import { grantXp } from "./rewards";

export const KUDOS_AMOUNTS = [5, 10, 25, 50] as const;
/** Most coins one person can give away per rolling 24 hours. */
export const KUDOS_DAILY_LIMIT = 100;
/** Small XP thank-you for the giver, once per kudos. */
export const KUDOS_GIVER_XP = 5;

export class KudosError extends Error {}

export async function sentToday(userId: string, now = new Date()) {
  const db = await getDb();
  const [r] = await db
    .select({ n: sum(kudos.coins) })
    .from(kudos)
    .where(and(eq(kudos.fromId, userId), gte(kudos.createdAt, new Date(now.getTime() - 86_400_000))));
  return Number(r.n ?? 0);
}

/** Move coins from one person to another with a thank-you message. */
export async function giveKudos(fromId: string, toId: string, coins: number, message: string, now = new Date()) {
  if (fromId === toId) throw new KudosError("You can't send kudos to yourself.");
  if (!KUDOS_AMOUNTS.includes(coins as (typeof KUDOS_AMOUNTS)[number])) throw new KudosError("Pick an amount.");
  const text = message.trim();
  if (text.length < 3) throw new KudosError("Say what they did. It means more!");
  if (text.length > 280) throw new KudosError("Keep it under 280 characters.");
  const already = await sentToday(fromId, now);
  if (already + coins > KUDOS_DAILY_LIMIT)
    throw new KudosError(`You can give up to ${KUDOS_DAILY_LIMIT} coins a day (${KUDOS_DAILY_LIMIT - already} left today).`);

  const db = await getDb();
  return db.transaction(async (tx) => {
    const [from] = await tx.select().from(users).where(eq(users.id, fromId)).for("update");
    const [to] = await tx.select().from(users).where(eq(users.id, toId));
    if (!to) throw new KudosError("That person wasn't found.");
    if (from.coins < coins) throw new KudosError(`You only have ${from.coins} coins.`);
    const [k] = await tx.insert(kudos).values({ fromId, toId, coins, message: text, createdAt: now }).returning();
    await grantXp(tx, fromId, KUDOS_GIVER_XP, -coins, "kudos_sent", k.id);
    await grantXp(tx, toId, 0, coins, "kudos", k.id);
    return { kudos: k, to };
  });
}

/** Recent kudos across the organisation (the kudos wall). */
export async function kudosFeed(limit = 30, userId?: string) {
  const db = await getDb();
  const giver = aliasedTable(users, "giver");
  const receiver = aliasedTable(users, "receiver");
  return db
    .select({
      id: kudos.id,
      coins: kudos.coins,
      message: kudos.message,
      createdAt: kudos.createdAt,
      from: { id: giver.id, name: giver.name, avatar: giver.avatar },
      to: { id: receiver.id, name: receiver.name, avatar: receiver.avatar },
    })
    .from(kudos)
    .innerJoin(giver, eq(giver.id, kudos.fromId))
    .innerJoin(receiver, eq(receiver.id, kudos.toId))
    .where(userId ? sql`${kudos.toId} = ${userId} or ${kudos.fromId} = ${userId}` : undefined)
    .orderBy(desc(kudos.createdAt))
    .limit(limit);
}

