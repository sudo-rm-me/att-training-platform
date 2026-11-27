import "server-only";
import { eq, sql } from "drizzle-orm";
import type { DB } from "@/db";
import { users, xpEvents } from "@/db/schema";

type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0] | DB;

/** Record an XP/coin grant in the ledger and update the user's totals. */
export async function grantXp(
  tx: Tx,
  userId: string,
  xp: number,
  coins: number,
  reason: string,
  refId?: string,
) {
  if (xp === 0 && coins === 0) return;
  await tx.insert(xpEvents).values({ userId, xp, coins, reason, refId });
  await tx
    .update(users)
    .set({ xp: sql`${users.xp} + ${xp}`, coins: sql`${users.coins} + ${coins}` })
    .where(eq(users.id, userId));
}

export const PERFECT_BONUS_XP = 25;

export function coinsForXp(xp: number) {
  return Math.round(xp / 2);
}
