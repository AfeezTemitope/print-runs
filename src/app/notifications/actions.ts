'use server';

import { revalidatePath } from 'next/cache';
import { and, eq, isNull } from 'drizzle-orm';
import { db, tables } from '@/db';
import { getSession } from '@/lib/auth';

/** Scoped to the signed-in user, so one person can never mark another's notifications read. */
export async function markRead(id: string) {
  const session = await getSession();
  if (!session) return { error: 'Log in first.' };
  await db().update(tables.notifications).set({ readAt: new Date() })
    .where(and(eq(tables.notifications.id, id), eq(tables.notifications.userId, session.uid)));
  revalidatePath('/notifications');
  revalidatePath('/', 'layout');
  return { ok: true as const };
}

export async function markAllRead() {
  const session = await getSession();
  if (!session) return { error: 'Log in first.' };
  await db().update(tables.notifications).set({ readAt: new Date() })
    .where(and(eq(tables.notifications.userId, session.uid), isNull(tables.notifications.readAt)));
  revalidatePath('/notifications');
  revalidatePath('/', 'layout');
  return { ok: true as const };
}
