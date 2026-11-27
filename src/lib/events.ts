import "server-only";
import { and, asc, desc, eq, gt, gte, lte, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { events, teams, users, xpEvents, type GameEvent } from "@/db/schema";
import type { Tx } from "./rewards";
import { grantXp } from "./rewards";

/** The live event with the biggest multiplier, if any. */
export async function activeEvent(now = new Date(), tx?: Tx): Promise<GameEvent | null> {
  const db = tx ?? (await getDb());
  const [e] = await db
    .select()
    .from(events)
    .where(and(lte(events.startsAt, now), gt(events.endsAt, now)))
    .orderBy(desc(events.xpMultiplier))
    .limit(1);
  return e ?? null;
}

/** The event to show on the dashboard: the live one, or the next within a week. */
export async function featuredEvent(now = new Date()) {
  const live = await activeEvent(now);
  if (live) return { event: live, live: true };
  const db = await getDb();
  const soon = new Date(now.getTime() + 7 * 86_400_000);
  const [next] = await db
    .select()
    .from(events)
    .where(and(gt(events.startsAt, now), lte(events.startsAt, soon)))
    .orderBy(asc(events.startsAt))
    .limit(1);
  return next ? { event: next, live: false } : null;
}

export function bannerEvent(e: GameEvent) {
  return {
    name: e.name,
    description: e.description,
    emoji: e.emoji,
    startsAt: e.startsAt.toISOString(),
    endsAt: e.endsAt.toISOString(),
    xpMultiplier: e.xpMultiplier,
    teamChallenge: e.teamChallenge,
  };
}

export async function upcomingEvents(now = new Date()) {
  const db = await getDb();
  return db.select().from(events).where(gt(events.endsAt, now)).orderBy(asc(events.startsAt)).limit(20);
}

export async function pastEvents(now = new Date()) {
  const db = await getDb();
  return db.select().from(events).where(lte(events.endsAt, now)).orderBy(desc(events.endsAt)).limit(20);
}

/** Extra XP from an event multiplier, recorded as its own ledger entry. */
export async function grantEventBonus(tx: Tx, userId: string, baseXp: number, refId: string, now = new Date()) {
  if (baseXp <= 0) return 0;
  const e = await activeEvent(now, tx);
  if (!e || e.xpMultiplier <= 100) return 0;
  const bonus = Math.round((baseXp * (e.xpMultiplier - 100)) / 100);
  await grantXp(tx, userId, bonus, Math.round(bonus / 2), "event", refId);
  return bonus;
}

/** Team standings for XP earned during an event. */
export async function eventStandings(e: Pick<GameEvent, "startsAt" | "endsAt">) {
  const db = await getDb();
  const rows = await db
    .select({
      teamId: teams.id,
      name: teams.name,
      icon: teams.icon,
      xp: sql<number>`coalesce(sum(${xpEvents.xp}), 0)`.mapWith(Number),
      people: sql<number>`count(distinct ${xpEvents.userId})`.mapWith(Number),
    })
    .from(xpEvents)
    .innerJoin(users, eq(users.id, xpEvents.userId))
    .innerJoin(teams, eq(teams.id, users.teamId))
    .where(and(gte(xpEvents.createdAt, e.startsAt), lte(xpEvents.createdAt, e.endsAt)))
    .groupBy(teams.id)
    .orderBy(desc(sql`sum(${xpEvents.xp})`));
  return rows.map((r, i) => ({ ...r, rank: i + 1 }));
}
