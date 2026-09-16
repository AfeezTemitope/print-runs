'use server';

import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';
import { db, tables } from '@/db';
import { getSession } from '@/lib/auth';

/**
 * The customer declines a quote (Module 2 §7.3). The order is cancelled rather than deleted —
 * the printer's time went into pricing it, and a declined quote is useful signal for both
 * sides. Accepting is not an action here: it routes to payment, and acceptance is the payment.
 */
export async function declineQuote(orderId: string) {
  const session = await getSession();
  if (!session) return { error: 'Log in first.' };

  const [order] = await db().select().from(tables.orders)
    .where(and(eq(tables.orders.id, orderId), eq(tables.orders.customerId, session.uid))).limit(1);
  if (!order) return { error: 'Order not found.' };
  if (order.paymentStatus === 'paid') return { error: 'That order is already paid.' };

  await db().update(tables.orders).set({
    status: 'cancelled',
    quoteDeclinedAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(tables.orders.id, orderId));

  revalidatePath('/orders');
  revalidatePath('/dashboard/quotes');
  return { ok: true } as const;
}
