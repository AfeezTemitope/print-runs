'use server';

import { and, avg, count, eq } from 'drizzle-orm';
import { db, tables } from '@/db';
import { getSession } from '@/lib/auth';

export async function submitReview(input: { orderId: string; rating: number; comment: string }) {
  const session = await getSession();
  if (!session) return { error: 'Log in first.' };
  if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) return { error: 'Pick 1–5 stars.' };

  const [order] = await db().select().from(tables.orders).where(and(
    eq(tables.orders.id, input.orderId),
    eq(tables.orders.customerId, session.uid),
    eq(tables.orders.status, 'delivered'),
  )).limit(1);
  if (!order) return { error: 'Only completed orders can be rated.' };

  await db().insert(tables.reviews).values({
    orderId: order.id,
    shopId: order.shopId,
    customerId: session.uid,
    rating: input.rating,
    comment: input.comment.slice(0, 500) || null,
  }).onConflictDoNothing();

  // Denormalised rating on the shop keeps the printer-selection query cheap.
  const [agg] = await db().select({ a: avg(tables.reviews.rating), c: count() })
    .from(tables.reviews).where(eq(tables.reviews.shopId, order.shopId));
  await db().update(tables.shops)
    .set({ ratingAvg: Number(agg.a ?? 0), ratingCount: agg.c })
    .where(eq(tables.shops.id, order.shopId));

  return { ok: true };
}
