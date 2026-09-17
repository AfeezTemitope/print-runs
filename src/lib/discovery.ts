import { and, eq, gte, inArray } from 'drizzle-orm';
import { db, tables } from '@/db';
import { fromPriceKobo } from '@/lib/listing-pricing';
import { getCategory } from '@/lib/catalog';
import { visibilityPenalty } from '@/lib/trust';

/**
 * Customer-facing printer discovery (Module 2, Sections 3 and 4).
 *
 * Both entry points show the same printer card, and both sort by distance from the customer.
 * A printer only surfaces where they have at least one ACTIVE listing — an empty storefront in
 * search results is a dead end for the customer and does the printer no favours either.
 */

export type PrinterCard = {
  id: string;
  slug: string;
  code: string;
  businessName: string;
  bannerUrl: string | null;
  logoUrl: string | null;
  area: string;
  verified: boolean;
  ratingAvg: number;
  ratingCount: number;
  categories: string[];
  fromKobo: number | null;
  distanceKm: number | null;
  /**
   * Module 4 §5.2: a silent ranking demotion for printers who have lost 2+ disputes in the
   * last 90 days. Never surfaced as a label — the printer is not told, and the customer just
   * sees better-performing printers first.
   */
  penalty: number;
};

/** Straight-line distance. Good enough to order a list by; not a routing estimate. */
export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Order printers by distance, then by rating. Printers with no coordinates sort last rather
 * than being dropped — a shop that has not pinned its location is still a real shop, and
 * hiding it would quietly punish the printer for a field they may not have noticed.
 */
export function sortByDistance(cards: PrinterCard[]): PrinterCard[] {
  return [...cards].sort((a, b) => {
    // Demoted printers sort below everyone else regardless of how close they are.
    if (a.penalty !== b.penalty) return a.penalty - b.penalty;
    if (a.distanceKm === null && b.distanceKm === null) return b.ratingAvg - a.ratingAvg;
    if (a.distanceKm === null) return 1;
    if (b.distanceKm === null) return -1;
    if (Math.abs(a.distanceKm - b.distanceKm) > 0.1) return a.distanceKm - b.distanceKm;
    return b.ratingAvg - a.ratingAvg;
  });
}

export type DiscoveryOptions = {
  categorySlug?: string;
  search?: string;
  origin?: { lat: number; lng: number } | null;
};

export async function findPrinters(opts: DiscoveryOptions = {}): Promise<PrinterCard[]> {
  const shops = await db().select().from(tables.shops).where(eq(tables.shops.isActive, true));
  if (!shops.length) return [];

  const listings = await db().select().from(tables.listings)
    .where(and(
      inArray(tables.listings.shopId, shops.map((s) => s.id)),
      eq(tables.listings.isActive, true),
    ));
  if (!listings.length) return [];

  const tierRows = listings.length
    ? await db().select().from(tables.listingTiers)
        .where(inArray(tables.listingTiers.listingId, listings.map((l) => l.id)))
    : [];
  const tiersByListing = new Map<string, typeof tierRows>();
  for (const t of tierRows) {
    tiersByListing.set(t.listingId, [...(tiersByListing.get(t.listingId) ?? []), t]);
  }

  // One query for every shop's recent lost disputes, rather than one per card.
  const since = new Date(Date.now() - 90 * 86_400_000);
  const lostRows = await db().select({ shopId: tables.disputes.shopId }).from(tables.disputes)
    .where(and(
      eq(tables.disputes.state, 'resolved_customer'),
      gte(tables.disputes.decidedAt, since),
    ));
  const lostByShop = new Map<string, number>();
  for (const r of lostRows) lostByShop.set(r.shopId, (lostByShop.get(r.shopId) ?? 0) + 1);

  const term = opts.search?.trim().toLowerCase();

  const cards: PrinterCard[] = [];
  for (const shop of shops) {
    let mine = listings.filter((l) => l.shopId === shop.id);
    if (opts.categorySlug) mine = mine.filter((l) => l.categorySlug === opts.categorySlug);
    if (!mine.length) continue;

    // Search matches the business name or the area — the two things a customer actually
    // types when looking for a specific printer (§4.2).
    if (term) {
      const haystack = `${shop.businessName} ${shop.addressCity ?? ''} ${shop.addressState ?? ''}`.toLowerCase();
      if (!haystack.includes(term)) continue;
    }

    const prices = mine
      .map((l) => fromPriceKobo(l, tiersByListing.get(l.id) ?? []))
      .filter((p): p is number => p !== null);

    cards.push({
      id: shop.id,
      slug: shop.slug,
      code: shop.code,
      businessName: shop.businessName,
      bannerUrl: shop.bannerUrl,
      logoUrl: shop.logoUrl,
      area: [shop.addressCity, shop.addressState].filter(Boolean).join(', '),
      // Tier 2 only. Tier 1 printers appear here without a badge, per the founder decision —
      // being unverified must not make a live printer invisible.
      verified: shop.verificationTier === 2,
      ratingAvg: shop.ratingAvg,
      ratingCount: shop.ratingCount,
      categories: [...new Set(mine.map((l) => l.categorySlug))]
        .map((slug) => getCategory(slug)?.name)
        .filter((n): n is string => Boolean(n))
        .slice(0, 3),
      fromKobo: prices.length ? Math.min(...prices) : null,
      penalty: visibilityPenalty(lostByShop.get(shop.id) ?? 0),
      distanceKm: opts.origin && shop.lat != null && shop.lng != null
        ? haversineKm(opts.origin, { lat: shop.lat, lng: shop.lng })
        : null,
    });
  }

  return sortByDistance(cards);
}

/** Categories that currently have at least one live listing, for the Products screen. */
export async function categoriesWithStock(): Promise<Set<string>> {
  const rows = await db()
    .select({ slug: tables.listings.categorySlug })
    .from(tables.listings)
    .innerJoin(tables.shops, eq(tables.listings.shopId, tables.shops.id))
    .where(and(eq(tables.listings.isActive, true), eq(tables.shops.isActive, true)))
    .groupBy(tables.listings.categorySlug);
  return new Set(rows.map((r) => r.slug));
}
