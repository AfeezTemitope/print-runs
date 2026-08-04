import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db, tables } from '@/db';
import { getSession } from '@/lib/auth';
import { getCategory } from '@/lib/categories';
import { computePrice, productMatchesSpec, computeOrderTotals, getPlatformFeeKobo } from '@/lib/pricing';
import { specFromParams } from '@/lib/spec';
import { paystackInitialize } from '@/lib/paystack';
import { orderCode } from '@/lib/format';
import type { PendingOrderMetadata } from '@/lib/settle';

/**
 * V2 checkout (Batch 1 foundation).
 *
 * Two real changes from V1:
 *  1. No pickup at checkout. Every order is 'delivery'; Collection is an ops-arranged
 *     fallback set later, never a customer choice here (decision, 28 Jul).
 *  2. The duplicate-order fix: for a PRICED order, this route no longer writes an orders
 *     row at all. It hands everything the order needs to Paystack as metadata and returns
 *     the payment link. The order is created exactly once, in settlePayment(), only after
 *     Paystack confirms the charge succeeded. An abandoned or retried checkout never leaves
 *     a stray "unpaid" row in the queue. Quote orders (no payment involved) still write
 *     immediately, same as before — there's nothing to duplicate against.
 */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Log in to place an order.' }, { status: 401 });

  const body = (await req.json().catch(() => null)) as Record<string, string> | null;
  if (!body) return NextResponse.json({ error: 'Bad request.' }, { status: 400 });

  const spec = specFromParams(body);
  const shopId = body.shop;
  const productId = body.product;

  if (!spec || !shopId || !productId || !getCategory(spec.category)) {
    return NextResponse.json({ error: 'Order details are incomplete.' }, { status: 400 });
  }

  const deliveryAddress = (body.deliveryAddress ?? '').trim();
  if (deliveryAddress.length < 6) {
    return NextResponse.json({ error: 'Enter a delivery address.' }, { status: 400 });
  }

  // V2 required checkout contact fields (decision 21): email + BOTH phone numbers.
  const contactEmail = (body.contactEmail ?? '').trim();
  const contactPhonePrimary = (body.contactPhonePrimary ?? '').trim();
  const contactPhoneSecondary = (body.contactPhoneSecondary ?? '').trim();
  if (!contactEmail || !contactEmail.includes('@')) {
    return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
  }
  if (contactPhonePrimary.length < 7) {
    return NextResponse.json({ error: 'Enter your primary phone number.' }, { status: 400 });
  }
  if (contactPhoneSecondary.length < 7) {
    return NextResponse.json({ error: 'Enter a second phone number — this is now required so we can reach you about delivery.' }, { status: 400 });
  }

  // V2 design-confirmation checkbox (Batch 1 foundation list): the customer must confirm
  // the uploaded artwork is final before an order can proceed.
  if (body.designConfirmed !== 'true') {
    return NextResponse.json({ error: 'Please confirm your artwork is final and ready to print.' }, { status: 400 });
  }

  const [shop] = await db().select().from(tables.shops).where(eq(tables.shops.id, shopId)).limit(1);
  const [product] = await db().select().from(tables.products).where(eq(tables.products.id, productId)).limit(1);
  if (!shop || !product || product.shopId !== shop.id || !product.isActive) {
    return NextResponse.json({ error: 'That printer or product is no longer available.' }, { status: 404 });
  }
  // QA 3.4: listings are separate products, so a Rounded card product must not be able to
  // settle a Standard card spec even if its id is posted directly.
  if (!productMatchesSpec(spec, product)) {
    return NextResponse.json({ error: 'That product does not match the spec you configured.' }, { status: 400 });
  }

  const [variants, addons] = await Promise.all([
    db().select().from(tables.productVariants).where(eq(tables.productVariants.productId, product.id)),
    db().select().from(tables.productAddons).where(eq(tables.productAddons.productId, product.id)),
  ]);
  const price = computePrice(spec, product, variants, addons);
  const isQuote = !price.ok;

  const [user] = await db().select().from(tables.users).where(eq(tables.users.id, session.uid)).limit(1);
  if (!user) return NextResponse.json({ error: 'Session expired — log in again.' }, { status: 401 });

  const code = orderCode();

  if (isQuote) {
    // No payment involved — nothing to duplicate against, so writing immediately is safe,
    // same as V1. Pricing/fee fields stay null until the printer quotes a price.
    await db().insert(tables.orders).values({
      code,
      customerId: user.id,
      shopId: shop.id,
      productId: product.id,
      spec,
      isQuote: true,
      fulfillmentMethod: 'delivery',
      deliveryAddress,
      contactEmail,
      contactPhonePrimary,
      contactPhoneSecondary,
      status: 'order_received',
      paymentStatus: 'unpaid',
      designFileUrl: body.file || null,
      designFileName: body.fileName || null,
      printNote: body.note?.trim() || null,
    });
    return NextResponse.json({ ok: true, quote: true, code });
  }

  // Priced order: compute the full 3-layer total, then hand everything to Paystack as
  // metadata. Nothing is written to the orders table in this branch — see settle.ts.
  const platformFeeKobo = await getPlatformFeeKobo((key) =>
    db().select().from(tables.platformSettings).where(eq(tables.platformSettings.key, key)).limit(1)
      .then((rows) => rows[0]),
  );
  const totals = computeOrderTotals(price.totalKobo, spec.qty ?? 1, product, platformFeeKobo);

  const metadata: PendingOrderMetadata = {
    customerId: user.id,
    shopId: shop.id,
    productId: product.id,
    spec: { ...spec, breakdown: price.lines },
    printerBaseKobo: totals.printerBaseKobo,
    marginKobo: totals.marginKobo,
    sellingPriceKobo: totals.sellingPriceKobo,
    platformFeeKobo: totals.platformFeeKobo,
    amountPaidKobo: totals.amountPaidKobo,
    deliveryAddress,
    contactEmail,
    contactPhonePrimary,
    contactPhoneSecondary,
    designFileUrl: body.file || null,
    designFileName: body.fileName || null,
    printNote: body.note?.trim() || null,
  };

  const origin = process.env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin;
  try {
    const init = await paystackInitialize({
      email: user.email,
      amountKobo: totals.amountPaidKobo,
      reference: code,
      callbackUrl: `${origin}/checkout/callback`,
      metadata,
    });
    return NextResponse.json({ ok: true, authorizationUrl: init.authorization_url });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Paystack is unreachable — try again shortly.' },
      { status: 502 },
    );
  }
}
