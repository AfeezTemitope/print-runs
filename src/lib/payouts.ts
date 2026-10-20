import { and, eq, inArray, isNull, lt } from 'drizzle-orm';
import { db, tables } from '@/db';
import { createRecipient, initiateTransfer, transfersEnabled } from '@/lib/paystack';
import { DISPUTE_WINDOW_HOURS } from '@/lib/trust';
import { effectiveTier } from '@/lib/subscriptions';
import { getTierConfig } from '@/lib/tier-config';
import { payoutSent } from '@/lib/notify';
import { naira } from '@/lib/format';

/** Tell the printer their money has gone. Never throws — the payout itself is what matters. */
export async function notifyPaid(payoutId: string) {
  try {
    const [row] = await db()
      .select({ payout: tables.payouts, order: tables.orders, shop: tables.shops })
      .from(tables.payouts)
      .innerJoin(tables.orders, eq(tables.payouts.orderId, tables.orders.id))
      .innerJoin(tables.shops, eq(tables.payouts.shopId, tables.shops.id))
      .where(eq(tables.payouts.id, payoutId)).limit(1);
    if (!row) return;
    const [owner] = await db().select().from(tables.users).where(eq(tables.users.id, row.shop.userId)).limit(1);
    await payoutSent(
      { userId: owner?.id, email: owner?.email },
      { code: row.order.code, amount: naira(row.payout.amountKobo), kind: row.payout.kind },
    );
  } catch (e) {
    console.error('[payouts] notify failed:', e);
  }
}

/**
 * How printers get paid (brief item #9).
 *
 *   customer pays → held → printer delivers → 48h dispute window → settlement → bank account
 *
 * The printer's cut is their own price, nothing else: the customer's payment minus the
 * platform fee minus PrintRuns' margin, which is exactly printerBaseKobo on the order.
 */

/** A Pro advance is half the printer's price, paid before delivery for materials. */
export const ADVANCE_SHARE = 0.5;

/** Statuses at which the printer has actually accepted the job (brief: "requires acceptance"). */
const ACCEPTED_STATUSES = ['printer_assigned', 'printing_in_progress', 'printing_completed', 'ready_for_dispatch'];

export function advanceAmount(printerBaseKobo: number): number {
  // Rounded DOWN so the advance plus the balance can never exceed what the printer is owed.
  return Math.floor(printerBaseKobo * ADVANCE_SHARE);
}

/**
 * What is still owed at settlement. An advance already paid is deducted, so across the two
 * payouts the printer receives their price exactly once — never 150% of it.
 */
export function settlementAmount(printerBaseKobo: number, advancePaidKobo: number): number {
  return Math.max(0, printerBaseKobo - advancePaidKobo);
}

export function canRequestAdvance(input: {
  tierAllowsAdvance: boolean;
  status: string;
  paymentStatus: string;
  disputedAt: Date | null;
  hasAdvance: boolean;
}): { ok: true } | { ok: false; reason: string } {
  if (!input.tierAllowsAdvance) return { ok: false, reason: 'Material advances are a Pro plan feature.' };
  if (input.paymentStatus !== 'paid') return { ok: false, reason: 'The customer has not paid for this order yet.' };
  if (input.hasAdvance) return { ok: false, reason: 'An advance has already been requested for this order.' };
  if (input.disputedAt) return { ok: false, reason: 'This order is under dispute.' };
  if (!ACCEPTED_STATUSES.includes(input.status)) {
    return { ok: false, reason: 'Accept the job first — advances are only for work you have started.' };
  }
  return { ok: true };
}

const reference = (kind: 'settlement' | 'advance', orderCode: string) =>
  `PRP-${kind === 'advance' ? 'A' : 'S'}-${orderCode}`;

/**
 * Create a payout row. Relies on the unique (order, kind) index for safety: a cron run racing
 * an admin click, or a retried webhook, simply fails to insert a second row rather than
 * creating a second payment. That index is the real guard — everything else is courtesy.
 */
async function recordPayout(input: {
  shopId: string; orderId: string; orderCode: string;
  kind: 'settlement' | 'advance'; amountKobo: number;
}) {
  const [row] = await db().insert(tables.payouts).values({
    shopId: input.shopId,
    orderId: input.orderId,
    kind: input.kind,
    amountKobo: input.amountKobo,
    reference: reference(input.kind, input.orderCode),
  }).onConflictDoNothing().returning();
  return row ?? null;
}

/**
 * Send a due payout. With transfers off, it stays due and an admin pays it by hand. With them
 * on, it goes to Paystack — and is marked 'processing', not 'paid', because a transfer is only
 * paid when Paystack's webhook says so. Marking paid on the request would lie when a transfer
 * is later reversed.
 */
export async function executePayout(payoutId: string): Promise<{ ok: true; state: string } | { ok: false; message: string }> {
  const [payout] = await db().select().from(tables.payouts).where(eq(tables.payouts.id, payoutId)).limit(1);
  if (!payout) return { ok: false, message: 'Payout not found.' };
  if (payout.state === 'paid') return { ok: true, state: 'paid' };
  if (payout.state === 'processing') return { ok: true, state: 'processing' };
  if (!transfersEnabled()) return { ok: true, state: 'due' };

  const [shop] = await db().select().from(tables.shops).where(eq(tables.shops.id, payout.shopId)).limit(1);
  if (!shop?.accountNumber || !shop.bankCode || !shop.bankVerifiedAt) {
    return { ok: false, message: 'The printer has not added a verified bank account yet.' };
  }

  let recipient = shop.paystackRecipientCode;
  if (!recipient) {
    const created = await createRecipient({
      name: shop.accountName ?? shop.businessName,
      accountNumber: shop.accountNumber,
      bankCode: shop.bankCode,
    });
    if (!created.ok) {
      await db().update(tables.payouts).set({ state: 'failed', failureReason: created.message })
        .where(eq(tables.payouts.id, payout.id));
      return { ok: false, message: created.message };
    }
    recipient = created.data.recipient_code;
    await db().update(tables.shops).set({ paystackRecipientCode: recipient }).where(eq(tables.shops.id, shop.id));
  }

  const sent = await initiateTransfer({
    amountKobo: payout.amountKobo,
    recipientCode: recipient,
    reference: payout.reference,
    reason: payout.kind === 'advance' ? 'PrintRuns material advance' : 'PrintRuns order settlement',
  });

  if (!sent.ok) {
    await db().update(tables.payouts).set({ state: 'failed', failureReason: sent.message })
      .where(eq(tables.payouts.id, payout.id));
    return { ok: false, message: sent.message };
  }

  /**
   * The request succeeding is NOT the transfer being sent. Paystack ships with "Confirm
   * transfers before sending" switched on, and in that mode it returns status 'otp': accepted,
   * but held until someone types a code from the business phone. Treating that as processing
   * would leave the payout waiting on a webhook that never comes — never paid, never flagged.
   *
   * So anything other than an in-flight status is surfaced as a failure an admin can see, with
   * the reason spelled out.
   */
  const status = (sent.data.status ?? '').toLowerCase();

  if (status === 'otp') {
    const reason = 'Paystack is asking for an OTP. Untick "Confirm transfers before sending" in Paystack → Settings → Preferences, then retry.';
    await db().update(tables.payouts)
      .set({ state: 'failed', transferCode: sent.data.transfer_code, failureReason: reason })
      .where(eq(tables.payouts.id, payout.id));
    return { ok: false, message: reason };
  }

  if (status === 'failed' || status === 'reversed') {
    const reason = `Paystack reported the transfer as ${status}.`;
    await db().update(tables.payouts)
      .set({ state: 'failed', transferCode: sent.data.transfer_code, failureReason: reason })
      .where(eq(tables.payouts.id, payout.id));
    return { ok: false, message: reason };
  }

  // In test mode Paystack returns success immediately, with no webhook to follow — so a
  // success here is final rather than something to wait on.
  if (status === 'success') {
    await db().update(tables.payouts).set({
      state: 'paid', paidBy: 'auto', paidAt: new Date(),
      transferCode: sent.data.transfer_code, failureReason: null,
    }).where(eq(tables.payouts.id, payout.id));
    await notifyPaid(payout.id);
    return { ok: true, state: 'paid' };
  }

  // 'pending' / 'processing' — genuinely in flight; the webhook settles it.
  await db().update(tables.payouts).set({
    state: 'processing', transferCode: sent.data.transfer_code, failureReason: null,
  }).where(eq(tables.payouts.id, payout.id));
  return { ok: true, state: 'processing' };
}

/** Statuses Paystack can return on a transfer request, and what each means for a payout. */
export function payoutStateFor(transferStatus: string): 'paid' | 'processing' | 'failed' {
  const s = transferStatus.toLowerCase();
  if (s === 'success') return 'paid';
  if (s === 'otp' || s === 'failed' || s === 'reversed') return 'failed';
  return 'processing';
}

/**
 * The 48-hour settlement run (brief: "settlement is automatically triggered").
 *
 * Finds delivered orders whose dispute window has closed, with no open dispute and nothing
 * paid out yet, and records what each printer is owed. Safe to run as often as you like —
 * the unique index means a second run finds nothing new to create.
 */
export async function runSettlement(now: Date = new Date()) {
  const cutoff = new Date(now.getTime() - DISPUTE_WINDOW_HOURS * 3_600_000);

  const eligible = await db().select().from(tables.orders).where(and(
    eq(tables.orders.status, 'delivered'),
    eq(tables.orders.paymentStatus, 'paid'),
    eq(tables.orders.settlementStatus, 'pending'),
    isNull(tables.orders.disputedAt),
    lt(tables.orders.deliveredAt, cutoff),
  ));

  let created = 0;
  let sent = 0;

  let skipped = 0;

  for (const order of eligible) {
    // A paid order with no recorded printer price is a data problem, not a zero. Settling it
    // at nothing would mark it done and the printer would never be paid — so it is left
    // pending for a human to look at instead.
    if (order.printerBaseKobo == null) { skipped += 1; continue; }

    const advances = await db().select().from(tables.payouts).where(and(
      eq(tables.payouts.orderId, order.id),
      eq(tables.payouts.kind, 'advance'),
    ));
    // Only an advance that actually reached the printer reduces what they are owed. A failed
    // or still-pending one must not be deducted, or they would be underpaid.
    const advancePaid = advances.filter((a) => a.state === 'paid').reduce((t, a) => t + a.amountKobo, 0);
    const owed = settlementAmount(order.printerBaseKobo, advancePaid);

    const payout = owed > 0
      ? await recordPayout({
          shopId: order.shopId, orderId: order.id, orderCode: order.code, kind: 'settlement', amountKobo: owed,
        })
      : null;

    // The order is settled either way — even an order fully covered by its advance is done.
    await db().update(tables.orders)
      .set({ settlementStatus: 'settled', settledAt: now, updatedAt: now })
      .where(eq(tables.orders.id, order.id));

    if (payout) {
      created += 1;
      const res = await executePayout(payout.id);
      if (res.ok && res.state === 'processing') sent += 1;
    }
  }

  return { checked: eligible.length, created, sent, skipped };
}

/** A Pro printer asks for half up front. Recorded as due; an admin releases it. */
export async function requestAdvance(orderId: string, shopId: string) {
  const [order] = await db().select().from(tables.orders)
    .where(and(eq(tables.orders.id, orderId), eq(tables.orders.shopId, shopId))).limit(1);
  if (!order) return { ok: false as const, message: 'Order not found.' };

  const [shop] = await db().select().from(tables.shops).where(eq(tables.shops.id, shopId)).limit(1);
  if (!shop) return { ok: false as const, message: 'Shop not found.' };

  const config = await getTierConfig();
  const existing = await db().select({ id: tables.payouts.id }).from(tables.payouts).where(and(
    eq(tables.payouts.orderId, orderId), eq(tables.payouts.kind, 'advance'),
  ));

  if (order.printerBaseKobo == null) {
    return { ok: false as const, message: 'This order has no printer price recorded — contact PrintRuns.' };
  }

  const check = canRequestAdvance({
    tierAllowsAdvance: config[effectiveTier(shop)].materialAdvance,
    status: order.status,
    paymentStatus: order.paymentStatus,
    disputedAt: order.disputedAt,
    hasAdvance: existing.length > 0,
  });
  if (!check.ok) return { ok: false as const, message: check.reason };

  const payout = await recordPayout({
    shopId, orderId, orderCode: order.code, kind: 'advance', amountKobo: advanceAmount(order.printerBaseKobo),
  });
  if (!payout) return { ok: false as const, message: 'An advance has already been requested for this order.' };
  return { ok: true as const, amountKobo: payout.amountKobo };
}

export async function payoutsFor(orderIds: string[]) {
  if (!orderIds.length) return [];
  return db().select().from(tables.payouts).where(inArray(tables.payouts.orderId, orderIds));
}
