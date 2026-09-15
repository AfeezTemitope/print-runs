import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getMyShop } from '@/lib/auth';
import { getCategory } from '@/lib/catalog';
import { fromPriceKobo } from '@/lib/listing-pricing';
import { subcategoriesFor, listingsFor, tiersForListings } from '@/lib/storefront';
import { ListingsClient, type ListingCard } from './ListingsClient';

export const metadata: Metadata = { title: 'Products' };

export default async function ListingsPage() {
  const shop = await getMyShop();
  if (!shop) redirect('/dashboard');

  const [subs, rows] = await Promise.all([subcategoriesFor(shop.id), listingsFor(shop.id)]);
  const tierMap = await tiersForListings(rows.map((r) => r.id));
  const subName = new Map(subs.map((s) => [s.id, s.name]));

  const listings: ListingCard[] = rows.map((l) => {
    const tiers = tierMap.get(l.id) ?? [];
    return {
      id: l.id,
      categorySlug: l.categorySlug,
      subcategoryId: l.subcategoryId ?? '',
      name: l.name,
      description: l.description ?? '',
      photos: l.photos ?? [],
      pricingMode: (l.pricingMode === 'quote' ? 'tier' : l.pricingMode) as ListingCard['pricingMode'],
      tiers: tiers
        .sort((a, b) => a.quantity - b.quantity)
        .map((t) => ({ quantity: String(t.quantity), price: String(t.priceKobo / 100) })),
      ratePerPiece: l.ratePerPieceKobo ? String(l.ratePerPieceKobo / 100) : '',
      ratePerArea: l.ratePerAreaKobo ? String(l.ratePerAreaKobo / 100) : '',
      areaUnit: (l.areaUnit ?? 'sqft') as 'sqft' | 'sqin',
      minCharge: l.minChargeKobo ? String(l.minChargeKobo / 100) : '',
      minimumOrder: l.minimumOrder ? String(l.minimumOrder) : '',
      turnaround: String(l.turnaroundHours),
      isActive: l.isActive,
      fromKobo: fromPriceKobo(l, tiers),
      subName: l.subcategoryId ? subName.get(l.subcategoryId) ?? null : null,
    };
  });

  const live = listings.filter((l) => l.isActive).length;
  const categories = [...new Set(listings.filter((l) => l.isActive).map((l) => l.categorySlug))];

  return (
    <div>
      <h1 className="font-display text-3xl font-extrabold tracking-tight text-black">Products</h1>
      <p className="mt-2 max-w-2xl text-black/60">
        Everything you sell, in your own words and at your own prices. Changes go live on your
        storefront immediately — nothing waits for approval.
      </p>
      {live > 0 && (
        <p className="mt-2 font-mono text-[11px] font-bold uppercase tracking-widest text-black/45">
          {live} live across {categories.length} {categories.length === 1 ? 'category' : 'categories'}
          {categories.length > 0 && ` · ${categories.map((c) => getCategory(c)?.name).filter(Boolean).join(', ')}`}
        </p>
      )}

      <div className="mt-7">
        <ListingsClient
          subs={subs.map((s) => ({ id: s.id, categorySlug: s.categorySlug, name: s.name, isCustom: s.isCustom }))}
          listings={listings}
        />
      </div>
    </div>
  );
}
