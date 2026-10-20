import { and, count, desc, eq, isNull } from 'drizzle-orm';
import { db, tables } from '@/db';

/** Unread count for the bell. Never throws — a broken inbox must not take the nav down. */
export async function unreadCount(userId: string): Promise<number> {
  try {
    const [row] = await db().select({ c: count() }).from(tables.notifications)
      .where(and(eq(tables.notifications.userId, userId), isNull(tables.notifications.readAt)));
    return Number(row?.c ?? 0);
  } catch {
    return 0;
  }
}

export async function recentNotifications(userId: string, limit = 50) {
  return db().select().from(tables.notifications)
    .where(eq(tables.notifications.userId, userId))
    .orderBy(desc(tables.notifications.createdAt))
    .limit(limit);
}
