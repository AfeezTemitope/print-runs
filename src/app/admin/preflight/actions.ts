'use server';

import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { db, tables } from '@/db';
import { getSession } from '@/lib/auth';
import { FAILURE_COPY, type CheckKey } from '@/lib/preflight';
import { preflightPassed, preflightFailed } from '@/lib/email';

async function assertAdmin() {
  const session = await getSession();
  return session && session.role === 'admin' ? session : null;
}

function touched(orderId: string) {
  revalidatePath('/admin/preflight');
  revalidatePath('/orders');
  revalidatePath(`/orders/${orderId}`);
  revalidatePath('/dashboard/queue');
}

/**
 * Pass: the order leaves PAUSED and the printer sees it for the first time (§5).
 */
export async function passReview(reviewId: string, note: string) {
  if (!(await assertAdmin())) return { error: 'Not allowed.' };

  const [review] = await db().select().from(tables.preflightReviews)
    .where(eq(tables.preflightReviews.id, reviewId)).limit(1);
  if (!review) return { error: 'Review not found.' };
  if (review.status !== 'pending') return { error: 'Already reviewed.' };

  const [order] = await db().select().from(tables.orders)
    .where(eq(tables.orders.id, review.orderId)).limit(1);
  if (!order) return { error: 'Order not found.' };

  await db().update(tables.preflightReviews).set({
    status: 'passed', decidedBy: 'human', reviewerNote: note.trim() || null, decidedAt: new Date(),
  }).where(eq(tables.preflightReviews.id, reviewId));

  // Only release an order that is actually paused — a customer may have overridden while the
  // review sat in the queue, and that must not rewind the status they already moved past.
  if (order.status === 'paused') {
    await db().update(tables.orders)
      .set({ status: 'order_received', updatedAt: new Date() })
      .where(eq(tables.orders.id, order.id));
  }

  const [shop] = await db().select().from(tables.shops)
    .where(eq(tables.shops.id, order.shopId)).limit(1);
  if (order.contactEmail) {
    await preflightPassed(order.contactEmail, { code: order.code, printer: shop?.businessName ?? 'your printer' });
  }

  touched(order.id);
  return { ok: true } as const;
}

/**
 * Fail: the order stays PAUSED and the customer is told exactly what to fix (§6.1). At least
 * one failed check is required — "it failed" with no reason leaves the customer nothing to act
 * on, which just becomes a support conversation.
 */
export async function failReview(reviewId: string, checks: string[], note: string) {
  if (!(await assertAdmin())) return { error: 'Not allowed.' };
  if (!checks.length) return { error: 'Tick at least one check that failed.' };

  const [review] = await db().select().from(tables.preflightReviews)
    .where(eq(tables.preflightReviews.id, reviewId)).limit(1);
  if (!review) return { error: 'Review not found.' };
  if (review.status !== 'pending') return { error: 'Already reviewed.' };

  const [order] = await db().select().from(tables.orders)
    .where(eq(tables.orders.id, review.orderId)).limit(1);
  if (!order) return { error: 'Order not found.' };

  const findings = checks.map((c) => ({
    check: c,
    note: FAILURE_COPY[c as CheckKey] ?? 'This check did not pass.',
  }));

  await db().update(tables.preflightReviews).set({
    status: 'failed', decidedBy: 'human', findings,
    reviewerNote: note.trim() || null, decidedAt: new Date(),
  }).where(eq(tables.preflightReviews.id, reviewId));

  if (order.contactEmail) {
    await preflightFailed(order.contactEmail, {
      code: order.code,
      issues: findings.map((f) => f.note),
      note: note.trim(),
    });
  }

  touched(order.id);
  return { ok: true } as const;
}
