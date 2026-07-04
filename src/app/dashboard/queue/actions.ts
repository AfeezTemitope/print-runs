'use server';

import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';
import { db, tables } from '@/db';
import { getMyShop } from '@/lib/auth';

/** Button 2 — flips the printed status: printing → ready. */
export async function markPrintingDone(orderId: string) {
  const shop = await getMyShop();
  if (!shop) return { error: 'Not your shop.' };

  const res = await db().update(tables.orders)
    .set({ status: 'ready', readyAt: new Date(), updatedAt: new Date() })
    .where(and(
      eq(tables.orders.id, orderId),
      eq(tables.orders.shopId, shop.id),
      eq(tables.orders.status, 'printing'), // valid transition only
    ))
    .returning({ id: tables.orders.id });
  if (!res.length) return { error: 'This job is not in a printable state.' };

  revalidatePath('/dashboard/queue');
  return { ok: true } as const;
}

/**
 * Button 3 — Dispatch Rider / Notify for Pickup. Guarded server-side too:
 * nothing dispatches or notifies before printing is done (spec §4.1).
 * V1 notification = this status flip, which the customer's tracker reads.
 */
export async function completeJob(orderId: string) {
  const shop = await getMyShop();
  if (!shop) return { error: 'Not your shop.' };

  const res = await db().update(tables.orders)
    .set({ status: 'completed', completedAt: new Date(), updatedAt: new Date() })
    .where(and(
      eq(tables.orders.id, orderId),
      eq(tables.orders.shopId, shop.id),
      eq(tables.orders.status, 'ready'), // locked until Button 2 was pressed
    ))
    .returning({ id: tables.orders.id });
  if (!res.length) return { error: 'Finish printing first — this job is not marked done.' };

  revalidatePath('/dashboard/queue');
  return { ok: true } as const;
}
