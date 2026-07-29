'use server';

import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';
import { db, tables } from '@/db';
import { getMyShop } from '@/lib/auth';
import { canDecline } from '@/lib/status';

/**
 * V2 queue actions. The V1 pair (markPrintingDone / completeJob) covered a 3-status
 * lifecycle; V2 has 7 (decision 18), so each transition is now explicit and guarded
 * server-side against its own valid predecessor.
 */

/** order_received | printer_assigned → printing_in_progress */
export async function startPrinting(orderId: string) {
  const shop = await getMyShop();
  if (!shop) return { error: 'Not your shop.' };

  const [order] = await db().select().from(tables.orders)
    .where(and(eq(tables.orders.id, orderId), eq(tables.orders.shopId, shop.id))).limit(1);
  if (!order) return { error: 'Not your job.' };
  if (order.status !== 'order_received' && order.status !== 'printer_assigned') {
    return { error: 'This job has already started.' };
  }

  await db().update(tables.orders)
    .set({ status: 'printing_in_progress', updatedAt: new Date() })
    .where(eq(tables.orders.id, orderId));

  revalidatePath('/dashboard/queue');
  return { ok: true } as const;
}

/** printing_in_progress → printing_completed */
export async function markPrintingDone(orderId: string) {
  const shop = await getMyShop();
  if (!shop) return { error: 'Not your shop.' };

  const res = await db().update(tables.orders)
    .set({ status: 'printing_completed', updatedAt: new Date() })
    .where(and(
      eq(tables.orders.id, orderId),
      eq(tables.orders.shopId, shop.id),
      eq(tables.orders.status, 'printing_in_progress'),
    ))
    .returning({ id: tables.orders.id });
  if (!res.length) return { error: 'This job is not currently printing.' };

  revalidatePath('/dashboard/queue');
  return { ok: true } as const;
}

/**
 * printing_completed → ready_for_dispatch.
 * This is the point the customer is notified the order is complete and available for
 * handover. For a Collection order it is also the point the printer's settlement
 * entitlement begins (decision 20) — a slow-to-collect customer must not hold their money.
 *
 * The "your order is ready" email hangs off readyAt; the email provider itself is still
 * to be added, so for now this timestamp is what that job will read.
 */
export async function markReadyForDispatch(orderId: string) {
  const shop = await getMyShop();
  if (!shop) return { error: 'Not your shop.' };

  const res = await db().update(tables.orders)
    .set({ status: 'ready_for_dispatch', readyAt: new Date(), updatedAt: new Date() })
    .where(and(
      eq(tables.orders.id, orderId),
      eq(tables.orders.shopId, shop.id),
      eq(tables.orders.status, 'printing_completed'),
    ))
    .returning({ id: tables.orders.id });
  if (!res.length) return { error: 'Finish printing first — this job is not marked done.' };

  revalidatePath('/dashboard/queue');
  return { ok: true } as const;
}

/** ready_for_dispatch → out_for_delivery. Delivery orders only. */
export async function dispatchRider(orderId: string) {
  const shop = await getMyShop();
  if (!shop) return { error: 'Not your shop.' };

  const [order] = await db().select().from(tables.orders)
    .where(and(eq(tables.orders.id, orderId), eq(tables.orders.shopId, shop.id))).limit(1);
  if (!order) return { error: 'Not your job.' };
  if (order.fulfillmentMethod === 'collection') {
    return { error: 'This order is being collected by the customer — use Confirm handover.' };
  }
  if (order.status !== 'ready_for_dispatch') return { error: 'This job is not ready for dispatch yet.' };

  await db().update(tables.orders)
    .set({ status: 'out_for_delivery', updatedAt: new Date() })
    .where(eq(tables.orders.id, orderId));

  revalidatePath('/dashboard/queue');
  return { ok: true } as const;
}

/**
 * → delivered. Risk passes to the customer at this moment (28 Jul decision):
 *   - delivery path:   out_for_delivery → delivered
 *   - collection path: ready_for_dispatch → delivered, on handover to the customer's rider
 *
 * On the collection path the printer must only release the goods to a collector PrintRuns
 * has confirmed, which is why the authorised-collector details are surfaced in the queue.
 */
export async function confirmHandover(orderId: string) {
  const shop = await getMyShop();
  if (!shop) return { error: 'Not your shop.' };

  const [order] = await db().select().from(tables.orders)
    .where(and(eq(tables.orders.id, orderId), eq(tables.orders.shopId, shop.id))).limit(1);
  if (!order) return { error: 'Not your job.' };

  const valid = order.fulfillmentMethod === 'collection'
    ? order.status === 'ready_for_dispatch'
    : order.status === 'out_for_delivery';
  if (!valid) {
    return {
      error: order.fulfillmentMethod === 'collection'
        ? 'Mark the job ready before handing it over.'
        : 'Dispatch the rider first.',
    };
  }

  await db().update(tables.orders)
    .set({ status: 'delivered', handoverAt: new Date(), updatedAt: new Date() })
    .where(eq(tables.orders.id, orderId));

  revalidatePath('/dashboard/queue');
  return { ok: true } as const;
}

/**
 * "Can't Fulfil" (decision 10 + 15). A printer may decline only before production starts.
 *
 * What this does NOT do: reassign the order or move any money. Automatic reassignment and
 * refunds are ops actions and land with the admin dashboard in Batch 3. What it does is
 * record the decline against the declining shop and flag the order for ops, so nothing is
 * silently lost and no refund happens without a human. Per decision 10 the rejection is
 * logged against the rejecting party rather than auto-deducted.
 */
export async function cantFulfil(orderId: string, reason: string) {
  const shop = await getMyShop();
  if (!shop) return { error: 'Not your shop.' };

  const [order] = await db().select().from(tables.orders)
    .where(and(eq(tables.orders.id, orderId), eq(tables.orders.shopId, shop.id))).limit(1);
  if (!order) return { error: 'Not your job.' };
  if (!canDecline(order.status)) {
    return { error: 'Printing has already started — contact PrintRuns support instead.' };
  }

  await db().insert(tables.orderReassignments).values({
    orderId: order.id,
    fromShopId: shop.id,
    toShopId: null,
    oldSellingPriceKobo: order.sellingPriceKobo ?? 0,
    newSellingPriceKobo: null,
    diffKobo: null,
    resolution: 'no_replacement', // ops will reassign or refund — see Batch 3
    reason: reason.trim() || 'Printer could not fulfil',
  });

  await db().update(tables.orders)
    .set({
      status: 'cancelled',
      refundStatus: 'requested',
      refundReason: `Declined by printer: ${reason.trim() || 'no reason given'}`,
      updatedAt: new Date(),
    })
    .where(eq(tables.orders.id, order.id));

  revalidatePath('/dashboard/queue');
  return { ok: true } as const;
}
