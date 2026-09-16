'use server';

import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';
import { db, tables } from '@/db';
import { getMyShop } from '@/lib/auth';
import { quoteReady } from '@/lib/email';

/**
 * The printer answers a quote request with a price (Module 2 §7.2). Nothing is charged here —
 * the customer reviews the price and pays from their own order screen, so a printer can never
 * put a number on a customer's card without them agreeing to it.
 */
export async function sendQuote(orderId: string, naira: string, note: string) {
  const shop = await getMyShop();
  if (!shop) return { error: 'Not your shop.' };

  const kobo = Math.round(Number(naira || 0) * 100);
  if (!Number.isFinite(kobo) || kobo <= 0) return { error: 'Enter your price in naira.' };
  if (kobo > 100_000_000) return { error: 'That looks too high — enter naira, not kobo.' };

  const [order] = await db().select().from(tables.orders)
    .where(and(eq(tables.orders.id, orderId), eq(tables.orders.shopId, shop.id))).limit(1);
  if (!order) return { error: 'Not your job.' };
  if (order.paymentStatus === 'paid') return { error: 'That order is already paid.' };
  if (order.status === 'cancelled') return { error: 'That order was cancelled.' };

  await db().update(tables.orders).set({
    quotedPriceKobo: kobo,
    quotedAt: new Date(),
    quoteNote: note.trim() || null,
    // Re-quoting clears an earlier decline: the customer said no to a different number.
    quoteDeclinedAt: null,
    updatedAt: new Date(),
  }).where(eq(tables.orders.id, orderId));

  if (order.contactEmail) {
    await quoteReady(order.contactEmail, {
      code: order.code,
      printer: shop.businessName,
      amount: kobo,
      note: note.trim(),
    });
  }

  revalidatePath('/dashboard/quotes');
  revalidatePath('/orders');
  return { ok: true } as const;
}
