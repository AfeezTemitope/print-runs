import { eq } from 'drizzle-orm';
import { naira } from '@/lib/format';
import { orderConfirmed, newJobForPrinter, designOrderConfirmed, newDesignBrief } from '@/lib/email';
import { specSummary } from '@/lib/spec';
import { db, tables } from '@/db';
import { paystackVerify } from '@/lib/paystack';
import { computeListingPrice } from '@/lib/listing-pricing';
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
  /** Module 3: the customer asked for a file check, so the order is created paused. */
  preflightRequested?: boolean;
  preflightFeeKobo?: number;
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
/**
 * Design purchases ride the same Paystack path as print, so the reference prefix decides which
 * settler runs. PRD- is a design order, PRR- a paid extra revision; anything else is print.
 * Branching on the reference rather than on metadata means a malformed or missing metadata
 * blob can never cause a design payment to be settled as a print order.
 */
export async function settlePayment(reference: string): Promise<{ ok: true } | { ok: false; message: string }> {
  if (reference.startsWith('PRD-')) return settleDesignOrder(reference);
  if (reference.startsWith('PRR-')) return settleRevisionCharge(reference);
  return settlePrintOrder(reference);
}

async function settlePrintOrder(reference: string): Promise<{ ok: true } | { ok: false; message: string }> {
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

  // V2: meta.productId carries the printer's LISTING id. The old products table is retired
  // and empty, so looking there would fail every order after the storefront rebuild.
  const [listing] = await db().select().from(tables.listings)
    .where(eq(tables.listings.id, meta.productId)).limit(1);
  if (!listing) {
    return { ok: false, message: 'That product is no longer available — contact support with your reference, you were charged.' };
  }

  const tiers = await db().select().from(tables.listingTiers)
    .where(eq(tables.listingTiers.listingId, listing.id));

  /**
   * Recompute from the printer's live listing — the metadata's own kobo numbers are never
   * trusted blindly. A quote has no computable price by definition, so it is exempt: the
   * agreed figure is the one the printer sent and the customer accepted.
   */
  const recomputed = computeListingPrice(listing, tiers, {
    qty: meta.spec.qty ?? 1,
    width: meta.spec.width,
    height: meta.spec.height,
  });
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
    productId: null,
    listingId: meta.productId,
    spec: { ...meta.spec, breakdown: [{ label: recomputed.detail, amountKobo: recomputed.totalKobo }] },
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
    /**
     * Module 3 §3.2. A preflight order is created PAUSED, so it never appears in the printer's
     * queue even momentarily. Setting it here rather than updating after insert means there is
     * no window in which the printer could see a file that has not been checked.
     */
    preflightRequested: Boolean(meta.preflightRequested),
    preflightFeeKobo: meta.preflightFeeKobo ?? 0,
    status: meta.preflightRequested ? ('paused' as const) : ('order_received' as const),
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

  // A paused order needs its first review round opened the moment payment lands, or the file
  // sits in limbo with the customer told it is being checked and nothing in the admin queue.
  if (order && meta.preflightRequested && meta.designFileUrl) {
    const { submitForReview } = await import('@/lib/preflight');
    await submitForReview(order.id, meta.designFileUrl, meta.designFileName);
  }

  // Only the call that actually inserted the order sends mail, so a retried webhook and a
  // returning browser tab cannot both send a receipt. Awaited but never allowed to throw:
  // the order is already recorded, and a failed email must not fail the payment.
  if (order) {
    const summary = specSummary(finalOrder.spec).join(' · ');
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

/* ------------------------------------------------------------------ */
/* Design settlement                                                   */
/* ------------------------------------------------------------------ */

export type PendingDesignMetadata = {
  kind: 'design';
  customerId: string;
  studioId: string;
  serviceId: string;
  serviceTitle: string;
  reviewMode: 'review' | 'direct';
  brief: string;
  briefFileUrl: string | null;
  contactEmail: string;
  contactPhone: string;
  designerBaseKobo: number;
  marginKobo: number;
  platformFeeKobo: number;
  amountPaidKobo: number;
  revisionsIncluded: number;
  extraRevisionKobo: number;
  legalVersionAccepted?: string;
  /** Module 3: the customer asked for a file check, so the order is created paused. */
  preflightRequested?: boolean;
  preflightFeeKobo?: number;
};

function isPendingDesignMetadata(m: unknown): m is PendingDesignMetadata {
  if (!m || typeof m !== 'object') return false;
  const r = m as Record<string, unknown>;
  return r.kind === 'design'
    && typeof r.customerId === 'string'
    && typeof r.studioId === 'string'
    && typeof r.serviceTitle === 'string'
    && typeof r.brief === 'string'
    && typeof r.designerBaseKobo === 'number'
    && typeof r.amountPaidKobo === 'number';
}

/**
 * Same contract as the print settler: the order row is created HERE, on first successful
 * verification, never at checkout. An abandoned payment leaves no stray row, and the unique
 * constraint on code makes the webhook/callback race a harmless no-op.
 */
async function settleDesignOrder(reference: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const [existing] = await db().select().from(tables.designOrders)
    .where(eq(tables.designOrders.code, reference)).limit(1);
  if (existing?.paymentStatus === 'paid') return { ok: true };

  let data;
  try {
    data = await paystackVerify(reference);
  } catch {
    return { ok: false, message: 'Could not reach Paystack. Try again in a moment.' };
  }
  if (data.status !== 'success') return { ok: false, message: 'Payment was not completed.' };

  const meta = data.metadata;
  if (!isPendingDesignMetadata(meta)) return { ok: false, message: 'This payment is missing its order details.' };

  // Recompute from the designer's own live price rather than trusting the metadata figures.
  const [service] = await db().select().from(tables.designerServices)
    .where(eq(tables.designerServices.id, meta.serviceId)).limit(1);
  const baseKobo = service?.priceKobo ?? meta.designerBaseKobo;
  const expected = baseKobo + meta.marginKobo + meta.platformFeeKobo;
  if (data.amount !== expected) {
    return { ok: false, message: 'Amount mismatch — contact support with your reference.' };
  }

  const [created] = await db().insert(tables.designOrders).values({
    code: reference,
    customerId: meta.customerId,
    studioId: meta.studioId,
    serviceId: meta.serviceId || null,
    serviceTitle: meta.serviceTitle,
    reviewMode: meta.reviewMode,
    status: 'brief_received',
    brief: meta.brief,
    briefFileUrl: meta.briefFileUrl,
    contactEmail: meta.contactEmail,
    contactPhone: meta.contactPhone,
    designerBaseKobo: baseKobo,
    marginKobo: meta.marginKobo,
    platformFeeKobo: meta.platformFeeKobo,
    amountPaidKobo: expected,
    revisionsIncluded: meta.revisionsIncluded,
    extraRevisionKobo: meta.extraRevisionKobo,
    paymentStatus: 'paid',
    legalVersionAccepted: meta.legalVersionAccepted ?? null,
  }).onConflictDoNothing().returning();

  if (created) {
    const [studio] = await db().select().from(tables.designerStudios)
      .where(eq(tables.designerStudios.id, meta.studioId)).limit(1);
    if (meta.contactEmail) {
      await designOrderConfirmed(meta.contactEmail, {
        code: reference,
        total: naira(expected),
        studio: studio?.displayName ?? 'your designer',
        reviewMode: meta.reviewMode,
      });
    }
    if (studio) {
      const [owner] = await db().select().from(tables.users)
        .where(eq(tables.users.id, studio.userId)).limit(1);
      if (owner?.email) await newDesignBrief(owner.email, { code: reference, service: meta.serviceTitle });
    }
  }

  return { ok: true };
}

/**
 * A paid extra revision. The charge row is created at checkout (unlike orders) because it
 * hangs off an order that already exists — there is nothing to duplicate, only to mark paid.
 */
async function settleRevisionCharge(reference: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const [charge] = await db().select().from(tables.designRevisionCharges)
    .where(eq(tables.designRevisionCharges.reference, reference)).limit(1);
  if (!charge) return { ok: false, message: 'That revision charge no longer exists.' };
  if (charge.paymentStatus === 'paid') return { ok: true };

  let data;
  try {
    data = await paystackVerify(reference);
  } catch {
    return { ok: false, message: 'Could not reach Paystack. Try again in a moment.' };
  }
  if (data.status !== 'success') return { ok: false, message: 'Payment was not completed.' };
  if (data.amount !== charge.amountKobo) {
    return { ok: false, message: 'Amount mismatch — contact support with your reference.' };
  }

  await db().update(tables.designRevisionCharges)
    .set({ paymentStatus: 'paid' })
    .where(eq(tables.designRevisionCharges.id, charge.id));

  return { ok: true };
}
