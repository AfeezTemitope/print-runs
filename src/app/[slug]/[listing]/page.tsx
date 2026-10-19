import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { and, eq } from 'drizzle-orm';
import { db, tables } from '@/db';
import { isReservedSlug } from '@/lib/catalog';
import { getTierConfig } from '@/lib/tier-config';
import { effectiveTier } from '@/lib/subscriptions';
import { ListingDetail, type DetailListing, type DetailTier } from './ListingDetail';

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

async function load(slug: string, listingId: string) {
  if (isReservedSlug(slug)) return null;
  const [shop] = await db().select().from(tables.shops)
    .where(and(eq(tables.shops.slug, slug), eq(tables.shops.isActive, true))).limit(1);
  if (!shop) return null;

  const [listing] = await db().select().from(tables.listings)
    .where(and(
      eq(tables.listings.id, listingId),
      // Scoped to the shop in the URL, so one printer's id cannot be viewed under another's
      // storefront, and an inactive listing is never reachable by direct link.
      eq(tables.listings.shopId, shop.id),
      eq(tables.listings.isActive, true),
    )).limit(1);
  if (!listing) return null;

  const tiers = await db().select().from(tables.listingTiers)
    .where(eq(tables.listingTiers.listingId, listing.id));

  return { shop, listing, tiers };
}

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string; listing: string }> },
): Promise<Metadata> {
  const { slug, listing } = await params;
  const found = await load(slug, listing);
  if (!found) return {};
  return {
    title: `${found.listing.name} — ${found.shop.businessName}`,
    description: found.listing.description ?? `${found.listing.name} printed by ${found.shop.businessName} in Lagos.`,
  };
}

export default async function ListingPage({
  params, searchParams,
}: {
  params: Promise<{ slug: string; listing: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug, listing: listingId } = await params;
  const found = await load(slug, listingId);
  if (!found) notFound();

  const { shop, listing, tiers } = found;
  const design = one((await searchParams).design);

  const tierConfig = await getTierConfig();
  const orderCapKobo = tierConfig[effectiveTier(shop)].orderCapKobo;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <Link href={`/${shop.slug}`} className="font-display text-[13px] font-bold text-black/45 hover:text-blue">
        ← {shop.businessName}
      </Link>
      <div className="mt-4">
        <ListingDetail
          listing={{
            id: listing.id,
            name: listing.name,
            description: listing.description,
            photos: listing.photos ?? [],
            pricingMode: listing.pricingMode,
            ratePerPieceKobo: listing.ratePerPieceKobo,
            ratePerAreaKobo: listing.ratePerAreaKobo,
            areaUnit: listing.areaUnit,
            minChargeKobo: listing.minChargeKobo,
            minimumOrder: listing.minimumOrder,
            turnaroundHours: listing.turnaroundHours,
          } as DetailListing}
          tiers={tiers as DetailTier[]}
          shop={{
            slug: shop.slug,
            businessName: shop.businessName,
            area: [shop.addressCity, shop.addressState].filter(Boolean).join(', '),
            verified: shop.verificationTier === 2,
            ratingAvg: shop.ratingAvg,
            ratingCount: shop.ratingCount,
          }}
          designCode={design}
          orderCapKobo={orderCapKobo}
        />
      </div>
    </div>
  );
}
