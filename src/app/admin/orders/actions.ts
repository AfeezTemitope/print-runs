'use server';

import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { db, tables } from '@/db';
import { getSession } from '@/lib/auth';
import { paystackRefund } from '@/lib/paystack';

async function assertAdmin() {
  const session = await getSession();
  if (!session || session.role !== 'admin') return null;
  return session;
}

async function loadOrder(orderId: string) {
  const [order] = await db().select().from(tables.orders).where(eq(tables.orders.id, orderId)).limit(1);
  return order ?? null;
}

function touched() {
  revalidatePath('/admin/orders');
  revalidatePath('/dashboard/queue');
  revalidatePath('/orders');
}

/**
 * The rep has spoken to the customer and is recording what they said. This is the only place
 * the delivery fee is agreed — nothing is charged, because the customer pays the rider in
 * cash. Declining does not cancel the order: it falls back to Collection, where the customer
 * sends their own rider, which is exactly what that path exists for.
 */
export async function recordDeliveryResponse(orderId: string, response: 'accepted' | 'declined') {
  if (!(await assertAdmin())) return { error: 'Not allowed.' };

  const order = await loadOrder(orderId);
  if (!order) return { error: 'Order not found.' };
  if (order.fulfillmentMethod === 'collection') return { error: 'This order is already on Collection.' };
  if (order.deliveryFeeStatus === 'not_set') return { error: 'The printer has not named a fee yet.' };
  if (order.status === 'out_for_delivery' || order.status === 'delivered') {
    return { error: 'This order has already left the shop.' };
  }

  await db().update(tables.orders).set({
    deliveryFeeStatus: response,
    deliveryFeeRespondedAt: new Date(),
    // Declined → the customer arranges their own rider. The fee stops applying entirely,
    // so it is cleared rather than left on the order looking payable.
    ...(response === 'declined'
      ? { fulfillmentMethod: 'collection' as const, deliveryFeeKobo: null }
      : {}),
    updatedAt: new Date(),
  }).where(eq(tables.orders.id, orderId));

  touched();
  return { ok: true } as const;
}

/**
 * Who PrintRuns has authorised to collect on the customer's behalf. The printer must not
 * release a job to anyone else, which is why these details surface in their queue.
 */
export async function setAuthorizedCollector(orderId: string, name: string, phone: string) {
  if (!(await assertAdmin())) return { error: 'Not allowed.' };
  if (name.trim().length < 2) return { error: "Enter the collector's name." };
  if (phone.replace(/\D/g, '').length < 7) return { error: "Enter the collector's phone number." };

  const order = await loadOrder(orderId);
  if (!order) return { error: 'Order not found.' };
  if (order.fulfillmentMethod !== 'collection') return { error: 'This order is not on Collection.' };

  await db().update(tables.orders).set({
    collectionAuthorizedName: name.trim(),
    collectionAuthorizedPhone: phone.trim(),
    updatedAt: new Date(),
  }).where(eq(tables.orders.id, orderId));

  touched();
  return { ok: true } as const;
}

/**
 * Ops-initiated switch to Collection without the customer having declined a fee — the
 * printer has no rider, the address is unreachable, that kind of thing.
 */
export async function switchToCollection(orderId: string) {
  if (!(await assertAdmin())) return { error: 'Not allowed.' };
  const order = await loadOrder(orderId);
  if (!order) return { error: 'Order not found.' };
  if (order.status === 'out_for_delivery' || order.status === 'delivered') {
    return { error: 'This order has already left the shop.' };
  }

  await db().update(tables.orders).set({
    fulfillmentMethod: 'collection',
    deliveryFeeKobo: null,
    deliveryFeeStatus: 'not_set',
    deliveryFeeQuotedAt: null,
    deliveryFeeRespondedAt: null,
    updatedAt: new Date(),
  }).where(eq(tables.orders.id, orderId));

  touched();
  return { ok: true } as const;
}

/**
 * Cancel and refund. Two shapes, both recorded rather than executed — the money moves in the
 * Paystack dashboard, and this is the record of what was decided and why:
 *
 *  full            — nothing was printed, the customer gets everything back.
 *  less_production — the job exists (unreachable customer, decision 22), so production costs
 *                    already incurred are deducted. The printer keeps their base price.
 *
 * The refund is submitted to Paystack for real. If Paystack refuses or is unreachable the
 * cancellation is still recorded and the reason says so, because the alternative — refusing
 * to cancel because a third party is down — leaves the customer with neither job nor money.
 *
 * Settlement is withheld either way: a cancelled order must not pay out on its own.
 */
export async function cancelAndRefund(
  orderId: string,
  mode: 'full' | 'less_production',
  reason: string,
  deductNaira?: string,
) {
  if (!(await assertAdmin())) return { error: 'Not allowed.' };
  if (reason.trim().length < 3) return { error: 'Give a reason — this is the audit trail.' };

  const order = await loadOrder(orderId);
  if (!order) return { error: 'Order not found.' };
  if (order.status === 'cancelled') return { error: 'Already cancelled.' };
  if (order.paymentStatus !== 'paid') {
    // An unpaid or quote-only order has nothing to refund, so it is simply cancelled.
    await db().update(tables.orders).set({
      status: 'cancelled', refundReason: reason.trim(),
      settlementStatus: 'withheld', updatedAt: new Date(),
    }).where(eq(tables.orders.id, orderId));
    touched();
    return { ok: true, refundKobo: 0 } as const;
  }

  const paid = order.amountPaidKobo ?? 0;
  let refundKobo = paid;

  if (mode === 'less_production') {
    const deduct = Math.round(Number(deductNaira || 0) * 100);
    if (!Number.isFinite(deduct) || deduct <= 0) return { error: 'Enter the production cost to deduct.' };
    if (deduct > paid) return { error: 'The deduction cannot exceed what the customer paid.' };
    refundKobo = paid - deduct;
  }

  // The order code IS the Paystack transaction reference (see settlePayment).
  const sent = refundKobo > 0
    ? await paystackRefund(order.code, refundKobo >= paid ? undefined : refundKobo)
    : ({ ok: true, status: 'nothing_to_refund' } as const);

  await db().update(tables.orders).set({
    status: 'cancelled',
    refundStatus: refundKobo >= paid ? 'full' : 'partial',
    refundAmountKobo: refundKobo,
    refundReason: sent.ok
      ? reason.trim()
      : `${reason.trim()} — REFUND NOT SENT (${sent.message}); issue it manually in Paystack.`,
    settlementStatus: 'withheld',
    updatedAt: new Date(),
  }).where(eq(tables.orders.id, orderId));

  touched();
  return sent.ok
    ? ({ ok: true, refundKobo } as const)
    : ({ ok: true, refundKobo, warning: `Order cancelled, but Paystack refused the refund: ${sent.message}. Issue it manually.` } as const);
}

/** Free-text log against the order — who was called, what they said. */
export async function saveOpsNote(orderId: string, note: string) {
  if (!(await assertAdmin())) return { error: 'Not allowed.' };
  await db().update(tables.orders)
    .set({ opsNote: note.slice(0, 2000), updatedAt: new Date() })
    .where(eq(tables.orders.id, orderId));
  touched();
  return { ok: true } as const;
}
