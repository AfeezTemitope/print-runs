import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { and, eq } from 'drizzle-orm';
import { db, tables } from '@/db';
import { getSession } from '@/lib/auth';
import { computeListingPrice } from '@/lib/listing-pricing';
import { computeOrderTotals, getFeeBands } from '@/lib/pricing';
import { platformFeeFor } from '@/lib/platform-fee';
import { getCategoryMargins, marginFor } from '@/lib/margins';
import { OrderClient, type OrderSummary } from './OrderClient';

export const metadata: Metadata = { title: 'Place your order' };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function OrderPage({
  searchParams,
}: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const listingId = one(sp.listing);
  if (!listingId) notFound();

  const session = await getSession();
  if (!session) {
    const back = `/order?${new URLSearchParams(
      Object.entries(sp).flatMap(([k, v]) => (one(v) ? [[k, one(v)!]] : [])) as [string, string][],
    ).toString()}`;
    redirect(`/login?next=${encodeURIComponent(back)}`);
  }

  const [listing] = await db().select().from(tables.listings)
    .where(and(eq(tables.listings.id, listingId), eq(tables.listings.isActive, true))).limit(1);
  if (!listing) notFound();

  const [shop] = await db().select().from(tables.shops)
    .where(and(eq(tables.shops.id, listing.shopId), eq(tables.shops.isActive, true))).limit(1);
  if (!shop) notFound();

  const tiers = await db().select().from(tables.listingTiers)
    .where(eq(tables.listingTiers.listingId, listing.id));

  const qty = Number(one(sp.qty)) || 1;
  const width = Number(one(sp.w)) || undefined;
  const height = Number(one(sp.h)) || undefined;

  const price = computeListingPrice(listing, tiers, { qty, width, height });
  // The URL can say quote, but an unpriceable spec is a quote whatever the URL says.
  const isQuote = one(sp.quote) === '1' || !price.ok;

  const [margins, feeBands] = await Promise.all([
    getCategoryMargins(),
    getFeeBands((key) =>
      db().select().from(tables.platformSettings).where(eq(tables.platformSettings.key, key)).limit(1)
        .then((rows) => rows[0])),
  ]);
  const margin = marginFor(margins, listing.categorySlug, {
    marginType: 'fixed', marginFixedKobo: 0, marginPercentBps: 0,
  });
  const platformFeeKobo = price.ok ? platformFeeFor(price.totalKobo, feeBands) : 0;
  const totals = price.ok
    ? computeOrderTotals(price.totalKobo, qty, margin, platformFeeKobo)
    : { printerBaseKobo: 0, marginKobo: 0, sellingPriceKobo: 0, platformFeeKobo: 0, amountPaidKobo: 0 };

  // An approved design from the Designer Marketplace, carried through and pre-attached.
  const designCode = one(sp.design);
  let design: { url: string; name: string } | undefined;
  if (designCode) {
    const [d] = await db().select().from(tables.designOrders)
      .where(and(
        eq(tables.designOrders.code, designCode),
        eq(tables.designOrders.customerId, session!.uid),
        eq(tables.designOrders.status, 'approved'),
      )).limit(1);
    if (d?.finalFileUrl) design = { url: d.finalFileUrl, name: `${d.serviceTitle} (${d.code})` };
  }

  const [account] = await db().select({ email: tables.users.email }).from(tables.users)
    .where(eq(tables.users.id, session!.uid)).limit(1);

  const specLine = listing.pricingMode === 'area' && width && height
    ? `${width} × ${height} ${listing.areaUnit === 'sqin' ? 'in' : 'ft'}${qty > 1 ? ` × ${qty}` : ''}`
    : `${qty.toLocaleString()} pcs`;

  const summary: OrderSummary = {
    listingId: listing.id,
    listingName: listing.name,
    shopName: shop.businessName,
    shopSlug: shop.slug,
    specLine,
    turnaroundHours: listing.turnaroundHours,
    isQuote,
    printerBaseKobo: totals.printerBaseKobo,
    marginKobo: totals.marginKobo,
    platformFeeKobo: totals.platformFeeKobo,
    totalKobo: totals.amountPaidKobo,
    qty,
    width,
    height,
    designUrl: design?.url,
    designName: design?.name,
    designCode: design ? designCode : undefined,
    defaultEmail: account?.email ?? '',
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <Link href={`/${shop.slug}/${listing.id}`} className="font-display text-[13px] font-bold text-black/45 hover:text-blue">
        ← Back to {listing.name}
      </Link>
      <h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight text-black">
        {isQuote ? 'Request a quote' : 'Place your order'}
      </h1>
      <p className="mb-7 mt-1 text-black/60">
        {isQuote
          ? `${shop.businessName} will send you a price to approve. You won't be charged yet.`
          : 'Confirm your details and pay securely with Paystack.'}
      </p>
      <OrderClient summary={summary} />
    </div>
  );
}
