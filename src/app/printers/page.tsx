import type { Metadata } from 'next';
import Link from 'next/link';
import { and, eq, gte, lte, inArray } from 'drizzle-orm';
import { MapPin, Star, Clock } from 'lucide-react';
import { db, tables } from '@/db';
import { getCategory } from '@/lib/categories';
import { computePrice, productMatchesSpec } from '@/lib/pricing';
import { specFromParams } from '@/lib/spec';
import { distanceKm, bbox, LAGOS } from '@/lib/geo';
import { naira } from '@/lib/format';
import { CodeBadge } from '@/components/ui/CodeBadge';
import { ButtonLink } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { LocateGate } from './LocateGate';

export const metadata: Metadata = { title: 'Choose a printer' };
export const dynamic = 'force-dynamic';

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/**
 * Screen 4 (spec §3): auto-detect location → nearby printers who can fulfil
 * this exact spec, sorted by distance. Fixed price, or the dashed
 * "Request quote" state when a printer hasn't priced this spec.
 */
export default async function PrintersPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const spec = specFromParams(sp);
  const cat = spec ? getCategory(spec.category) : undefined;

  if (!spec || !cat) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <EmptyState
          title="No spec to match yet"
          hint="Configure a product first, then we’ll find printers for it."
          action={<ButtonLink href="/products">Pick a product</ButtonLink>}
        />
      </div>
    );
  }

  const lat = one(sp.lat) ? Number(one(sp.lat)) : null;
  const lng = one(sp.lng) ? Number(one(sp.lng)) : null;
  if (lat == null || lng == null) return <LocateGate />;

  // Indexed bounding-box prefilter; haversine refines and sorts below.
  const box = bbox(lat, lng);
  const shops = await db().select().from(tables.shops).where(and(
    eq(tables.shops.isActive, true),
    gte(tables.shops.lat, box.minLat), lte(tables.shops.lat, box.maxLat),
    gte(tables.shops.lng, box.minLng), lte(tables.shops.lng, box.maxLng),
  ));

  const shopIds = shops.map((s) => s.id);
  const prods = shopIds.length
    ? await db().select().from(tables.products).where(and(
        inArray(tables.products.shopId, shopIds),
        eq(tables.products.categorySlug, spec.category),
        eq(tables.products.isActive, true),
      ))
    : [];
  const prodIds = prods.map((p) => p.id);
  const [variants, addons] = prodIds.length
    ? await Promise.all([
        db().select().from(tables.productVariants).where(inArray(tables.productVariants.productId, prodIds)),
        db().select().from(tables.productAddons).where(inArray(tables.productAddons.productId, prodIds)),
      ])
    : [[], []];

  const cards = shops.flatMap((shop) => {
    const candidates = prods.filter((p) => p.shopId === shop.id && productMatchesSpec(spec, p));
    if (!candidates.length) return [];
    // Best quotable price wins; otherwise the shop shows as Request Quote.
    let best: { productId: string; totalKobo: number; turnaround: number } | null = null;
    let quoteProduct = candidates[0];
    for (const p of candidates) {
      const r = computePrice(spec, p, variants.filter((v) => v.productId === p.id), addons.filter((a) => a.productId === p.id));
      if (r.ok && (!best || r.totalKobo < best.totalKobo)) {
        best = { productId: p.id, totalKobo: r.totalKobo, turnaround: p.turnaroundHours };
      }
      if (p.pricingMode === 'quote') quoteProduct = p;
    }
    const km = shop.lat != null && shop.lng != null ? distanceKm(lat, lng, shop.lat, shop.lng) : null;
    return [{ shop, best, quoteProductId: quoteProduct.id, km }];
  }).sort((a, b) => (a.km ?? 1e9) - (b.km ?? 1e9));

  const query = new URLSearchParams(Object.entries(sp).flatMap(([k, v]) => (one(v) ? [[k, one(v)!]] : []))).toString();
  const usingFallback = Math.abs(lat - LAGOS.lat) < 0.0001 && Math.abs(lng - LAGOS.lng) < 0.0001;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <p className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-blue">Step 2 of 3</p>
      <h1 className="mt-1 font-display text-4xl font-extrabold tracking-tight text-black">
        Printers <span className="text-blue">near you</span>
      </h1>
      <p className="mt-2 flex items-center gap-1.5 text-sm text-black/55">
        <MapPin className="size-4" />
        {usingFallback ? 'Showing Lagos-wide (location not shared)' : 'Sorted by distance from your location'}
        · {cat.name}
      </p>

      {cards.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            title="No printers for this spec yet"
            hint="Try a different size or quantity — or check back soon, new printers join weekly."
            action={<ButtonLink href={`/configure/${cat.slug}`} variant="secondary">Adjust spec</ButtonLink>}
          />
        </div>
      ) : (
        <ul className="mt-8 space-y-4">
          {cards.map(({ shop, best, quoteProductId, km }) => {
            const href = `/checkout?${query}&shop=${shop.id}&product=${best ? best.productId : quoteProductId}${best ? '' : '&quote=1'}`;
            return (
              <li
                key={shop.id}
                className={`rounded-2xl bg-white p-5 sm:p-6 ${best ? 'border border-black/12' : 'border border-dashed border-black/30'}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2.5">
                      <h2 className="font-display text-xl font-extrabold tracking-tight text-navy">{shop.businessName}</h2>
                      <CodeBadge code={shop.code} />
                    </div>
                    <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-black/55">
                      {km != null && <span className="flex items-center gap-1"><MapPin className="size-3.5" />{km.toFixed(1)} km away</span>}
                      {shop.ratingCount > 0 ? (
                        <span className="flex items-center gap-1"><Star className="size-3.5 fill-pale text-navy" />{shop.ratingAvg.toFixed(1)} ({shop.ratingCount})</span>
                      ) : (
                        <span className="font-mono text-[10px] uppercase tracking-widest">New printer</span>
                      )}
                      {best && <span className="flex items-center gap-1"><Clock className="size-3.5" />~{best.turnaround}hrs</span>}
                      {shop.supportsPickup && <span className="rounded-pill bg-pale px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-navy">Pickup available</span>}
                    </p>
                  </div>
                  <div className="text-right">
                    {best ? (
                      <>
                        <p className="font-display text-2xl font-extrabold text-navy">{naira(best.totalKobo)}</p>
                        <p className="font-mono text-[10px] uppercase tracking-widest text-black/45">for this spec</p>
                      </>
                    ) : (
                      <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-navy/60">No fixed price<br />for this spec</p>
                    )}
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-dashed border-black/25 pt-4">
                  <Link href={href} className="font-display text-sm font-bold text-blue">
                    {best ? 'View breakdown' : 'What happens next?'}
                  </Link>
                  <ButtonLink href={href} size="sm" variant={best ? 'primary' : 'secondary'}>
                    {best ? 'Select' : 'Request quote'} <span aria-hidden>→</span>
                  </ButtonLink>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
