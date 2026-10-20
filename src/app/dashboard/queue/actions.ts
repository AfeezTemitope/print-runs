'use server';

import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';
import { db, tables } from '@/db';
import { getMyShop } from '@/lib/auth';
import { canDecline, canDispatch, canSetDeliveryFee, dispatchBlockedReason } from '@/lib/status';
import { orderReady, orderOnTheWay } from '@/lib/notify';
import { naira } from '@/lib/format';

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
 * Sends the "your order is ready" email on the transition — the readyAt timestamp is what
 * that email hangs off, and it is only written once, so the mail cannot be sent twice.
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
    .returning();
  if (!res.length) return { error: 'Finish printing first — this job is not marked done.' };

  const updated = res[0];
  {
    await orderReady({ userId: updated.customerId, email: updated.contactEmail }, {
      code: updated.code,
      printer: shop.businessName,
      collection: updated.fulfillmentMethod === 'collection',
    });
  }

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
  // The customer pays the rider in cash on arrival, so nothing leaves the shop until a rep
  // has confirmed they accepted the fee. Otherwise the rider rides out on a maybe.
  if (!canDispatch(order.fulfillmentMethod, order.status, order.deliveryFeeStatus)) {
    return { error: dispatchBlockedReason(order.fulfillmentMethod, order.status, order.deliveryFeeStatus) ?? 'Not ready.' };
  }

  await db().update(tables.orders)
    .set({ status: 'out_for_delivery', updatedAt: new Date() })
    .where(eq(tables.orders.id, orderId));

  // Reminds them of the exact cash amount to have ready, which is the whole risk in a
  // cash-on-delivery handover: a rider arriving to someone with no money in the house.
  {
    await orderOnTheWay({ userId: order.customerId, email: order.contactEmail }, { code: order.code, fee: naira(order.deliveryFeeKobo) });
  }

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
    // deliveredAt starts BOTH the 48-hour dispute window and the 7-day review window, so it
    // is stamped at the same instant the status changes (Module 4 §3.1, §4.1).
    .set({ status: 'delivered', handoverAt: new Date(), deliveredAt: new Date(), updatedAt: new Date() })
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

/**
 * The printer names their own delivery fee (the locked decision on fee source). It is NOT
 * charged through PrintRuns — a rep relays the number by phone and the customer pays the
 * rider in cash on arrival, so this only records the amount and flags it for that call.
 *
 * Re-quoting is allowed right up until dispatch, but it resets an already-accepted fee back
 * to 'quoted': a customer who agreed to 2,000 has not agreed to 3,500.
 */
export async function setDeliveryFee(orderId: string, naira: string) {
  const shop = await getMyShop();
  if (!shop) return { error: 'Not your shop.' };

  const kobo = Math.round(Number(naira || 0) * 100);
  if (!Number.isFinite(kobo) || kobo <= 0) return { error: 'Enter the delivery fee in naira.' };
  if (kobo > 50_000_00) return { error: 'That looks too high — enter the fee in naira, not kobo.' };

  const [order] = await db().select().from(tables.orders)
    .where(and(eq(tables.orders.id, orderId), eq(tables.orders.shopId, shop.id))).limit(1);
  if (!order) return { error: 'Not your job.' };
  if (!canSetDeliveryFee(order.fulfillmentMethod, order.status)) {
    return {
      error: order.fulfillmentMethod === 'collection'
        ? 'This order is being collected — there is no delivery fee.'
        : 'This order has already left the shop.',
    };
  }

  await db().update(tables.orders).set({
    deliveryFeeKobo: kobo,
    deliveryFeeStatus: 'quoted',
    deliveryFeeQuotedAt: new Date(),
    deliveryFeeRespondedAt: null,
    updatedAt: new Date(),
  }).where(eq(tables.orders.id, orderId));

  revalidatePath('/dashboard/queue');
  revalidatePath('/admin/orders');
  return { ok: true } as const;
}
