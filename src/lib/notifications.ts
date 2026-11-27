import "server-only";
import { and, desc, eq, isNull } from "drizzle-orm";
import { getDb } from "@/db";
import { notifications, type Notification } from "@/db/schema";

export type NotificationKind = "reminder" | "nudge" | "summary" | "kudos";
export type NewNotification = { userId: string; kind: NotificationKind; title: string; body?: string; link?: string | null };

export async function notify(items: NewNotification | NewNotification[]) {
  const list = Array.isArray(items) ? items : [items];
  if (list.length === 0) return;
  const db = await getDb();
  await db.insert(notifications).values(list.map((n) => ({ ...n, body: n.body ?? "", link: n.link ?? null })));
}

export async function listNotifications(userId: string, limit = 20): Promise<Notification[]> {
  const db = await getDb();
  return db.select().from(notifications).where(eq(notifications.userId, userId)).orderBy(desc(notifications.createdAt)).limit(limit);
}

export async function markAllRead(userId: string) {
  const db = await getDb();
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
}
