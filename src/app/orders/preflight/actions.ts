'use server';

import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';
import { db, tables } from '@/db';
import { getSession } from '@/lib/auth';
import { latestReview, submitForReview } from '@/lib/preflight';

const CLOUDINARY = /^https:\/\/res\.cloudinary\.com\//;

async function myOrder(orderId: string) {
  const session = await getSession();
  if (!session) return null;
  const [order] = await db().select().from(tables.orders)
    .where(and(eq(tables.orders.id, orderId), eq(tables.orders.customerId, session.uid))).limit(1);
  return order ?? null;
}

/** Fix and resubmit (§6.3). Free, and unlimited in V1. */
export async function resubmitFile(orderId: string, fileUrl: string, fileName: string) {
  const order = await myOrder(orderId);
  if (!order) return { error: 'Order not found.' };
  if (order.status !== 'paused') return { error: 'This order has already been sent to the printer.' };
  if (!CLOUDINARY.test(fileUrl)) return { error: 'Upload the file rather than pasting a link.' };

  await db().update(tables.orders)
    .set({ designFileUrl: fileUrl, designFileName: fileName || null, updatedAt: new Date() })
    .where(eq(tables.orders.id, order.id));

  await submitForReview(order.id, fileUrl, fileName || null);

  revalidatePath('/orders');
  revalidatePath('/admin/preflight');
  return { ok: true } as const;
}

/**
 * Override and send anyway (§6.4).
 *
 * preflightOverriddenAt is set permanently and never cleared. If the customer later raises a
 * quality complaint, it is the record that they were warned and accepted responsibility — so
 * a passing resubmission afterwards must not erase it.
 */
export async function overridePreflight(orderId: string, accepted: boolean) {
  if (!accepted) return { error: 'Tick the box to confirm you accept responsibility.' };

  const order = await myOrder(orderId);
  if (!order) return { error: 'Order not found.' };
  if (order.status !== 'paused') return { error: 'This order has already been sent to the printer.' };

  const review = await latestReview(order.id);
  if (!review || review.status !== 'failed') {
    return { error: 'There is nothing to override — your file has not failed a check.' };
  }

  await db().update(tables.orders).set({
    status: 'order_received',
    preflightOverriddenAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(tables.orders.id, order.id));

  revalidatePath('/orders');
  revalidatePath('/dashboard/queue');
  return { ok: true } as const;
}
