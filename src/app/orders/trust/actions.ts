'use server';

import { revalidatePath } from 'next/cache';
import { and, eq, sql } from 'drizzle-orm';
import { db, tables } from '@/db';
import { getSession } from '@/lib/auth';
import { canRaiseDispute, canReview } from '@/lib/trust';

const CLOUDINARY = /^https:\/\/res\.cloudinary\.com\//;

async function myOrder(orderId: string) {
  const session = await getSession();
  if (!session) return null;
  const [order] = await db().select().from(tables.orders)
    .where(and(eq(tables.orders.id, orderId), eq(tables.orders.customerId, session.uid))).limit(1);
  return order ? { order, session } : null;
}

/**
 * §3.2: a star rating is required, the written review is optional. The shop's aggregate is
 * recomputed from the reviews themselves rather than incremented, so a later removal by an
 * admin corrects the average instead of leaving it permanently skewed.
 */
export async function leaveReview(orderId: string, rating: number, comment: string) {
  const found = await myOrder(orderId);
  if (!found) return { error: 'Order not found.' };
  if (rating < 1 || rating > 5) return { error: 'Choose between 1 and 5 stars.' };

  const [existing] = await db().select({ id: tables.reviews.id }).from(tables.reviews)
    .where(eq(tables.reviews.orderId, orderId)).limit(1);
  if (!canReview(found.order, Boolean(existing))) {
    return { error: 'The review window for this order has closed.' };
  }

  await db().insert(tables.reviews).values({
    orderId,
    shopId: found.order.shopId,
    customerId: found.session.uid,
    rating,
    comment: comment.trim() || null,
  });

  await recomputeRating(found.order.shopId);

  revalidatePath('/orders');
  revalidatePath('/dashboard/reviews');
  return { ok: true } as const;
}

export async function recomputeRating(shopId: string) {
  const [agg] = await db()
    .select({
      avg: sql<number>`coalesce(avg(${tables.reviews.rating}), 0)`,
      count: sql<number>`count(*)`,
    })
    .from(tables.reviews)
    .where(and(eq(tables.reviews.shopId, shopId), sql`${tables.reviews.removedAt} is null`));

  await db().update(tables.shops)
    .set({ ratingAvg: Number(agg?.avg ?? 0), ratingCount: Number(agg?.count ?? 0) })
    .where(eq(tables.shops.id, shopId));
}

/**
 * §4.2: raising a dispute freezes settlement immediately. The freeze happens here rather than
 * at decision time, because the whole point of the 48-hour window is to stop money moving
 * before anyone has looked.
 */
export async function raiseDispute(
  orderId: string,
  reason: 'not_delivered' | 'wrong_product' | 'quality' | 'damaged' | 'other',
  detail: string,
  evidenceUrls: string[],
) {
  const found = await myOrder(orderId);
  if (!found) return { error: 'Order not found.' };
  if (!canRaiseDispute(found.order)) {
    return { error: 'The 48-hour dispute window for this order has closed.' };
  }
  if (reason === 'other' && detail.trim().length < 10) {
    return { error: 'Tell us what went wrong.' };
  }

  const evidence = evidenceUrls.filter((u) => CLOUDINARY.test(u)).slice(0, 5);

  await db().insert(tables.disputes).values({
    orderId,
    shopId: found.order.shopId,
    customerId: found.session.uid,
    reason,
    detail: detail.trim() || null,
    evidenceUrls: evidence,
  });

  await db().update(tables.orders).set({
    disputedAt: new Date(),
    settlementStatus: 'withheld',
    updatedAt: new Date(),
  }).where(eq(tables.orders.id, orderId));

  revalidatePath('/orders');
  revalidatePath('/admin/disputes');
  revalidatePath('/dashboard/queue');
  return { ok: true } as const;
}
