import { eq } from 'drizzle-orm';
import { naira } from '@/lib/format';
import { orderConfirmed, newJobForPrinter } from '@/lib/email';
import { specSummary } from '@/lib/spec';
import { listingLabel } from '@/lib/categories';
import { db, tables } from '@/db';
import { paystackVerify } from '@/lib/paystack';
import { computePrice } from '@/lib/pricing';
import type { OrderSpec } from '@/db/schema';

/**
 * V2 order-creation metadata (decision — Batch 1 duplicate-order fix). Everything Paystack
 * needs to hand back at verification time so the order row can be created for the FIRST time
 * here, once payment is confirmed — never earlier. checkout/route.ts never inserts an order
 * row for a priced (non-quote) order; it only reaches Paystack. This is what makes that safe:
 * if a customer abandons payment, there is no stray "unpaid" row cluttering the queue, and a
 * retried checkout can't create two rows for one purchase, since orders.code is unique and the
 * insert below is a no-op on conflict.
 */
export type PendingOrderMetadata = {
  customerId: string;
  shopId: string;
  productId: string;
  spec: OrderSpec;
  printerBaseKobo: number;
  marginKobo: number;
  sellingPriceKobo: number;
  platformFeeKobo: number;
  amountPaidKobo: number;
  deliveryAddress: string;
  contactEmail: string;
  contactPhonePrimary: string;
  contactPhoneSecondary: string;
  legalVersionAccepted?: string;
  designFileUrl: string | null;
  designFileName: string | null;
  printNote: string | null;
};

function isPendingOrderMetadata(m: unknown): m is PendingOrderMetadata {
  if (!m || typeof m !== 'object') return false;
  const r = m as Record<string, unknown>;
  return (
    typeof r.customerId === 'string' &&
    typeof r.shopId === 'string' &&
    typeof r.productId === 'string' &&
    typeof r.spec === 'object' && r.spec !== null &&
    typeof r.printerBaseKobo === 'number' &&
    typeof r.marginKobo === 'number' &&
    typeof r.sellingPriceKobo === 'number' &&
    typeof r.platformFeeKobo === 'number' &&
    typeof r.amountPaidKobo === 'number' &&
    typeof r.deliveryAddress === 'string' &&
    typeof r.contactEmail === 'string' &&
    typeof r.contactPhonePrimary === 'string' &&
    typeof r.contactPhoneSecondary === 'string'
  );
}

/**
 * Verify with Paystack and, on first successful verification, CREATE the order.
 * Idempotent — the callback page and the webhook both call this, whichever lands first wins:
 * - If an order with this code already exists and is paid, no-op.
 * - Otherwise verify with Paystack, recompute the price server-side from the metadata's spec
 *   (never trust the metadata's own kobo figures as gospel — only as the shape of the order),
 *   confirm what Paystack actually charged matches that recomputation, then insert the order.
 * - The unique constraint on orders.code makes a genuine race between the webhook and the
 *   callback page harmless: whichever insert loses is treated as an idempotent no-op.
 */
export async function settlePayment(reference: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const [existing] = await db().select().from(tables.orders).where(eq(tables.orders.code, reference)).limit(1);
  if (existing && existing.paymentStatus === 'paid') return { ok: true }; // already settled

  let data: Awaited<ReturnType<typeof paystackVerify>>;
  try {
    data = await paystackVerify(reference);
  } catch {
    return { ok: false, message: 'Verification with Paystack failed — if you were charged, it will settle automatically.' };
  }

  if (data.status !== 'success') return { ok: false, message: 'The payment was not completed.' };

  // Legacy/edge path: an order row already exists (e.g. a quote that later got a manual
  // payment link). Fall back to the old update-in-place behaviour rather than double-insert.
  if (existing) {
    if (existing.amountPaidKobo != null && data.amount < existing.amountPaidKobo) {
      return { ok: false, message: 'Amount mismatch — contact support with your reference.' };
    }
    await db().update(tables.orders)
      .set({ paymentStatus: 'paid', status: 'order_received', updatedAt: new Date() })
      .where(eq(tables.orders.id, existing.id));
    await db().insert(tables.payments).values({
      orderId: existing.id,
      reference,
      amountKobo: data.amount,
      channel: data.channel,
      status: data.status,
      paidAt: data.paid_at ? new Date(data.paid_at) : new Date(),
      raw: data as unknown as Record<string, unknown>,
    }).onConflictDoNothing();
    return { ok: true };
  }

  // Expected path for every priced order: create it for the first time, right here.
  const meta = data.metadata;
  if (!isPendingOrderMetadata(meta)) {
    return { ok: false, message: 'Payment succeeded but order details were missing — contact support with your reference.' };
  }

  const [product] = await db().select().from(tables.products).where(eq(tables.products.id, meta.productId)).limit(1);
  if (!product) {
    return { ok: false, message: 'That product is no longer available — contact support with your reference, you were charged.' };
  }
  const [variants, addons] = await Promise.all([
    db().select().from(tables.productVariants).where(eq(tables.productVariants.productId, product.id)),
    db().select().from(tables.productAddons).where(eq(tables.productAddons.productId, product.id)),
  ]);

  // Recompute from the spec — the metadata's own kobo numbers are never trusted blindly.
  // meta.spec is typed as the DB's OrderSpec (slightly looser types for JSON storage) but was
  // built from a validated CustomerSpec in checkout/route.ts before being handed to Paystack.
  const recomputed = computePrice(meta.spec as unknown as Parameters<typeof computePrice>[0], product, variants, addons);
  if (!recomputed.ok || recomputed.totalKobo !== meta.printerBaseKobo) {
    return { ok: false, message: 'Pricing changed after payment — contact support with your reference, you were charged.' };
  }
  if (data.amount !== meta.amountPaidKobo) {
    return { ok: false, message: 'Amount mismatch — contact support with your reference.' };
  }

  const [order] = await db().insert(tables.orders).values({
    code: reference,
    customerId: meta.customerId,
    shopId: meta.shopId,
    productId: meta.productId,
    spec: { ...meta.spec, breakdown: recomputed.lines },
    isQuote: false,
    printerBaseKobo: meta.printerBaseKobo,
    marginKobo: meta.marginKobo,
    sellingPriceKobo: meta.sellingPriceKobo,
    platformFeeKobo: meta.platformFeeKobo,
    amountPaidKobo: meta.amountPaidKobo,
    fulfillmentMethod: 'delivery', // never customer-chosen at checkout (decision, 28 Jul)
    deliveryAddress: meta.deliveryAddress,
    contactEmail: meta.contactEmail,
    contactPhonePrimary: meta.contactPhonePrimary,
    contactPhoneSecondary: meta.contactPhoneSecondary,
    // Frozen onto the order at the moment of payment, so a dispute months later can be
    // answered with the exact document version the customer agreed to.
    legalVersionAccepted: meta.legalVersionAccepted ?? null,
    legalAcceptedAt: meta.legalVersionAccepted ? new Date() : null,
    status: 'order_received',
    paymentStatus: 'paid',
    settlementStatus: 'pending',
    designFileUrl: meta.designFileUrl,
    designFileName: meta.designFileName,
    printNote: meta.printNote,
  }).onConflictDoNothing({ target: tables.orders.code }).returning();

  // If we lost a race to another settle() call, fetch what the winner inserted.
  const finalOrder = order ?? (await db().select().from(tables.orders).where(eq(tables.orders.code, reference)).limit(1))[0];
  if (!finalOrder) return { ok: false, message: 'Could not record the order — contact support with your reference.' };

  await db().insert(tables.payments).values({
    orderId: finalOrder.id,
    reference,
    amountKobo: data.amount,
    channel: data.channel,
    status: data.status,
    paidAt: data.paid_at ? new Date(data.paid_at) : new Date(),
    raw: data as unknown as Record<string, unknown>,
  }).onConflictDoNothing();

  // Only the call that actually inserted the order sends mail, so a retried webhook and a
  // returning browser tab cannot both send a receipt. Awaited but never allowed to throw:
  // the order is already recorded, and a failed email must not fail the payment.
  if (order) {
    const summary = specSummary(finalOrder.spec, listingLabel(finalOrder.spec.category, finalOrder.spec.listing)).join(' · ');
    const [shop] = await db().select().from(tables.shops).where(eq(tables.shops.id, finalOrder.shopId)).limit(1);

    if (finalOrder.contactEmail) {
      await orderConfirmed(finalOrder.contactEmail, {
        code: finalOrder.code,
        total: naira(finalOrder.amountPaidKobo),
        printer: shop?.businessName ?? 'your printer',
      });
    }

    if (shop) {
      const [owner] = await db().select().from(tables.users).where(eq(tables.users.id, shop.userId)).limit(1);
      if (owner?.email) await newJobForPrinter(owner.email, { code: finalOrder.code, summary });
    }
  }

  return { ok: true };
}
