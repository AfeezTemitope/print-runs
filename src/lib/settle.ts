import { eq } from 'drizzle-orm';
import { db, tables } from '@/db';
import { paystackVerify } from '@/lib/paystack';

/**
 * Verify with Paystack and settle the order. Idempotent — the callback page
 * and the webhook both call this, whichever lands first wins, the other no-ops.
 * Payment success moves the order into the queue: status 'printing'.
 */
export async function settlePayment(reference: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const [order] = await db().select().from(tables.orders).where(eq(tables.orders.code, reference)).limit(1);
  if (!order) return { ok: false, message: 'We could not find that order.' };
  if (order.paymentStatus === 'paid') return { ok: true }; // already settled

  let data: Awaited<ReturnType<typeof paystackVerify>>;
  try {
    data = await paystackVerify(reference);
  } catch {
    return { ok: false, message: 'Verification with Paystack failed — if you were charged, it will settle automatically.' };
  }

  if (data.status !== 'success') return { ok: false, message: 'The payment was not completed.' };
  if (order.priceKobo != null && data.amount < order.priceKobo) {
    return { ok: false, message: 'Amount mismatch — contact support with your reference.' };
  }

  await db().update(tables.orders)
    .set({ paymentStatus: 'paid', status: 'printing', updatedAt: new Date() })
    .where(eq(tables.orders.id, order.id));

  // Ledger row; unique(reference) makes double-settlement a no-op.
  await db().insert(tables.payments).values({
    orderId: order.id,
    reference,
    amountKobo: data.amount,
    channel: data.channel,
    status: data.status,
    paidAt: data.paid_at ? new Date(data.paid_at) : new Date(),
    raw: data as unknown as Record<string, unknown>,
  }).onConflictDoNothing();

  return { ok: true };
}
