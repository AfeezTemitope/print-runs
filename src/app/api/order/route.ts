import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db, tables } from '@/db';
import { getSession } from '@/lib/auth';
import { getCategory } from '@/lib/catalog';
import { computeListingPrice } from '@/lib/listing-pricing';
import { computeOrderTotals, getPlatformFeeKobo } from '@/lib/pricing';
import { getCategoryMargins, marginFor } from '@/lib/margins';
import { LEGAL_VERSION } from '@/lib/legal';
import { paystackInitialize } from '@/lib/paystack';
import { orderCode } from '@/lib/format';
import type { PendingOrderMetadata } from '@/lib/settle';

/**
 * V2 order placement (Module 2, Section 6).
 *
 * Replaces the product-first checkout: an order now points at a printer's own listing, and the
 * price is recomputed here from that listing rather than trusted from the browser. The client
 * shows a live total for responsiveness; this is the number that is actually charged.
 *
 * Priced orders still create no row until Paystack confirms — the duplicate-order fix from
 * Batch 1 holds. Quote requests write immediately: there is no payment to duplicate against,
 * and the printer needs something to respond to.
 */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Log in to place an order.' }, { status: 401 });

  const body = (await req.json().catch(() => null)) as Record<string, string> | null;
  if (!body) return NextResponse.json({ error: 'Bad request.' }, { status: 400 });

  const isQuote = body.quote === '1';

  const [listing] = await db().select().from(tables.listings)
    .where(and(eq(tables.listings.id, body.listing ?? ''), eq(tables.listings.isActive, true))).limit(1);
  if (!listing) return NextResponse.json({ error: 'That product is no longer available.' }, { status: 404 });

  const [shop] = await db().select().from(tables.shops)
    .where(and(eq(tables.shops.id, listing.shopId), eq(tables.shops.isActive, true))).limit(1);
  if (!shop) return NextResponse.json({ error: 'That printer is not taking orders right now.' }, { status: 404 });

  const deliveryAddress = (body.deliveryAddress ?? '').trim();
  if (deliveryAddress.length < 6) return NextResponse.json({ error: 'Enter a delivery address.' }, { status: 400 });

  const contactEmail = (body.contactEmail ?? '').trim();
  const contactPhonePrimary = (body.contactPhonePrimary ?? '').trim();
  const contactPhoneSecondary = (body.contactPhoneSecondary ?? '').trim();
  if (!contactEmail.includes('@')) return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
  if (contactPhonePrimary.replace(/\D/g, '').length < 7) {
    return NextResponse.json({ error: 'Enter your primary phone number.' }, { status: 400 });
  }
  // Required since the co-founder's decision: delivery is arranged by phone, so one
  // unreachable number should not strand a paid job.
  if (contactPhoneSecondary.replace(/\D/g, '').length < 7) {
    return NextResponse.json({ error: 'Enter a second phone number — we need it to reach you about delivery.' }, { status: 400 });
  }
  if (body.designConfirmed !== 'true' && !isQuote) {
    return NextResponse.json({ error: 'Please confirm your artwork is final and ready to print.' }, { status: 400 });
  }
  if (body.legalAccepted !== 'true') {
    return NextResponse.json({ error: 'Please accept the Terms and policies to continue.' }, { status: 400 });
  }

  const tiers = await db().select().from(tables.listingTiers)
    .where(eq(tables.listingTiers.listingId, listing.id));

  const qty = Number(body.qty) || 1;
  const width = Number(body.w) || undefined;
  const height = Number(body.h) || undefined;

  const price = computeListingPrice(listing, tiers, { qty, width, height });

  const spec = {
    category: listing.categorySlug,
    listingId: listing.id,
    listingName: listing.name,
    pricingMode: listing.pricingMode,
    qty,
    width,
    height,
    unit: listing.areaUnit === 'sqin' ? 'in' : listing.areaUnit === 'sqft' ? 'ft' : undefined,
    priceDetail: price.ok ? price.detail : undefined,
    printNote: body.note?.trim() || null,
  };

  const common = {
    customerId: session.uid,
    shopId: shop.id,
    listingId: listing.id,
    deliveryAddress,
    contactEmail,
    contactPhonePrimary,
    contactPhoneSecondary,
    designFileUrl: body.file || null,
    designFileName: body.fileName || null,
    legalVersionAccepted: LEGAL_VERSION,
  };

  /* ---------------------------------------------------------------- quote */
  if (isQuote || !price.ok) {
    const code = orderCode();
    await db().insert(tables.orders).values({
      ...common,
      code,
      status: 'order_received',
      paymentStatus: 'unpaid',
      fulfillmentMethod: 'delivery',
      spec: { ...spec, printNote: spec.printNote ?? undefined },
      printerBaseKobo: 0,
      marginKobo: 0,
      sellingPriceKobo: 0,
      platformFeeKobo: 0,
      amountPaidKobo: 0,
      legalAcceptedAt: new Date(),
    });
    return NextResponse.json({ ok: true, quote: true, code });
  }

  /* --------------------------------------------------------------- priced */
  const [margins, platformFeeKobo] = await Promise.all([
    getCategoryMargins(),
    getPlatformFeeKobo((key) =>
      db().select().from(tables.platformSettings).where(eq(tables.platformSettings.key, key)).limit(1)
        .then((rows) => rows[0])),
  ]);

  // The commercial margin is still per category and admin-editable — the storefront rebuild
  // changed how a printer prices, not how PrintRuns earns.
  const margin = marginFor(margins, listing.categorySlug, {
    marginType: 'fixed', marginFixedKobo: 0, marginPercentBps: 0,
  });
  const totals = computeOrderTotals(price.totalKobo, qty, margin, platformFeeKobo);

  const reference = orderCode();
  const metadata: PendingOrderMetadata = {
    customerId: session.uid,
    shopId: shop.id,
    productId: listing.id,
    spec: { ...spec, printNote: spec.printNote ?? undefined },
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
    printNote: spec.printNote,
    legalVersionAccepted: LEGAL_VERSION,
  };

  const origin = process.env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin;
  try {
    const init = await paystackInitialize({
      email: contactEmail,
      amountKobo: totals.amountPaidKobo,
      reference,
      callbackUrl: `${origin}/checkout/callback`,
      metadata: metadata as unknown as Record<string, unknown>,
    });
    return NextResponse.json({ ok: true, authorizationUrl: init.authorization_url });
  } catch {
    return NextResponse.json({ error: 'Could not start payment. Try again.' }, { status: 502 });
  }
}
