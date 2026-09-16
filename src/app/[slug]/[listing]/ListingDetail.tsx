'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BadgeCheck, Star } from 'lucide-react';
import { naira } from '@/lib/format';
import { computeListingPrice, needsCustomQuantity, sortTiers } from '@/lib/listing-pricing';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select } from '@/components/ui/Field';

export type DetailListing = {
  id: string;
  name: string;
  description: string | null;
  photos: string[];
  pricingMode: 'tier' | 'piece' | 'area' | 'quote';
  ratePerPieceKobo: number | null;
  ratePerAreaKobo: number | null;
  areaUnit: 'sqft' | 'sqin' | null;
  minChargeKobo: number | null;
  minimumOrder: number | null;
  turnaroundHours: number;
};

export type DetailTier = { id: string; listingId: string; quantity: number; priceKobo: number };

export type DetailShop = {
  slug: string; businessName: string; area: string;
  verified: boolean; ratingAvg: number; ratingCount: number;
};

/**
 * Listing detail (§5). The same screen regardless of which entry point the customer came
 * through. Price updates the instant they tap or type — no submit, no reload — and the maths
 * is the shared engine, so what they watch here is what the server charges.
 */
export function ListingDetail({
  listing, tiers, shop, designCode,
}: {
  listing: DetailListing;
  tiers: DetailTier[];
  shop: DetailShop;
  designCode?: string;
}) {
  const router = useRouter();
  const sorted = useMemo(() => sortTiers(tiers as never), [tiers]) as DetailTier[];

  const [photo, setPhoto] = useState(0);
  const [qty, setQty] = useState<number>(() => {
    if (listing.pricingMode === 'tier') return sorted[0]?.quantity ?? 0;
    return listing.minimumOrder ?? 1;
  });
  const [customQty, setCustomQty] = useState('');
  const [width, setWidth] = useState('');
  const [height, setHeight] = useState('');
  const [areaQty, setAreaQty] = useState('1');

  const effectiveQty = listing.pricingMode === 'area'
    ? Number(areaQty) || 1
    : customQty !== '' ? Number(customQty) : qty;

  const price = computeListingPrice(
    listing as never,
    sorted as never,
    {
      qty: effectiveQty,
      width: Number(width) || undefined,
      height: Number(height) || undefined,
    },
  );

  const overTop = listing.pricingMode === 'tier'
    && needsCustomQuantity(listing as never, sorted as never, effectiveQty);

  function order(quote: boolean) {
    const p = new URLSearchParams({ listing: listing.id });
    if (listing.pricingMode === 'area') {
      p.set('w', width); p.set('h', height); p.set('qty', String(effectiveQty));
    } else {
      p.set('qty', String(effectiveQty));
    }
    if (quote) p.set('quote', '1');
    if (designCode) p.set('design', designCode);
    router.push(`/order?${p.toString()}`);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
      <div>
        <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-black/12 bg-pale/30">
          {listing.photos[photo] && (
            <Image src={listing.photos[photo]} alt={listing.name} fill sizes="640px" className="object-cover" priority />
          )}
        </div>
        {listing.photos.length > 1 && (
          <ul className="mt-2.5 flex gap-2">
            {listing.photos.map((url, i) => (
              <li key={url}>
                <button onClick={() => setPhoto(i)} aria-label={`Photo ${i + 1}`}
                  className={`relative block size-16 overflow-hidden rounded-xl border-2 ${i === photo ? 'border-blue' : 'border-black/10'}`}>
                  <Image src={url} alt="" fill sizes="64px" className="object-cover" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h1 className="font-display text-3xl font-extrabold leading-tight tracking-tight text-black">{listing.name}</h1>

        <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-black/55">
          <span>by <Link href={`/${shop.slug}`} className="font-semibold text-navy hover:text-blue">{shop.businessName}</Link></span>
          {shop.verified && (
            <span className="flex items-center gap-1 font-mono text-[10px] font-bold uppercase tracking-widest text-success">
              <BadgeCheck className="size-3.5" /> Verified
            </span>
          )}
          {shop.ratingCount > 0 && (
            <span className="flex items-center gap-1 font-mono text-[11px] font-bold text-navy">
              <Star className="size-3.5 fill-current text-blue" />{shop.ratingAvg.toFixed(1)}
            </span>
          )}
        </p>

        {listing.description && (
          <p className="mt-3 whitespace-pre-line text-[15px] leading-relaxed text-black/70">{listing.description}</p>
        )}

        <p className="mt-3 font-mono text-[11px] font-bold uppercase tracking-widest text-black/45">
          Turnaround {listing.turnaroundHours}hrs
          {listing.minimumOrder ? ` · Minimum ${listing.minimumOrder} pcs` : ''}
        </p>

        <div className="mt-5 rounded-2xl border border-black/12 bg-white p-5">
          {listing.pricingMode === 'tier' && (
            <>
              <span className="mb-2.5 block font-display text-[13px] font-bold text-navy">Select quantity</span>
              <div className="flex flex-wrap gap-2">
                {sorted.map((t) => (
                  <button key={t.id}
                    onClick={() => { setQty(t.quantity); setCustomQty(''); }}
                    className={`rounded-pill border px-4 py-2 font-mono text-[13px] font-bold ${
                      !customQty && qty === t.quantity ? 'border-blue bg-blue text-white' : 'border-black/20 text-navy hover:border-black/45'
                    }`}>
                    {t.quantity.toLocaleString()} pcs
                  </button>
                ))}
                <Input inputMode="numeric" value={customQty} placeholder="Other"
                  onChange={(e) => setCustomQty(e.target.value.replace(/\D/g, ''))}
                  aria-label="Custom quantity" className="!w-28" />
              </div>
            </>
          )}

          {listing.pricingMode === 'piece' && (
            <Field label="Quantity">
              <Input inputMode="numeric" value={customQty || String(qty)}
                onChange={(e) => setCustomQty(e.target.value.replace(/\D/g, ''))}
                className="!w-40" />
            </Field>
          )}

          {listing.pricingMode === 'area' && (
            <>
              <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2.5">
                <Field label="Width"><Input inputMode="decimal" value={width} onChange={(e) => setWidth(e.target.value)} placeholder="0" /></Field>
                <span className="pb-3 font-display text-lg font-extrabold text-navy" aria-hidden>×</span>
                <Field label="Height"><Input inputMode="decimal" value={height} onChange={(e) => setHeight(e.target.value)} placeholder="0" /></Field>
              </div>
              <p className="mt-1 font-mono text-[11px] uppercase tracking-widest text-black/45">
                in {listing.areaUnit === 'sqin' ? 'inches' : 'feet'}
              </p>
              <Field label="How many?" hint="Same size, multiple copies.">
                <Input inputMode="numeric" value={areaQty} className="!w-28"
                  onChange={(e) => setAreaQty(e.target.value.replace(/\D/g, ''))} />
              </Field>
            </>
          )}

          <div className="mt-4 flex items-baseline justify-between border-t border-dashed border-black/20 pt-3.5">
            <span className="font-display text-[13px] font-bold text-navy">Total</span>
            <span className="font-display text-2xl font-extrabold text-navy">
              {price.ok ? naira(price.totalKobo) : '—'}
            </span>
          </div>
          {price.ok
            ? <p className="mt-0.5 text-right font-mono text-[11px] text-black/45">{price.detail}</p>
            : <p className="mt-0.5 text-right font-mono text-[11px] text-black/45">{price.reason}</p>}

          {price.ok ? (
            <Button className="mt-4 w-full" onClick={() => order(false)}>
              Order now <span aria-hidden>→</span>
            </Button>
          ) : (
            <>
              <Button className="mt-4 w-full" variant="secondary" onClick={() => order(true)}>
                {overTop ? 'Request a custom quantity' : 'Request a quote'} <span aria-hidden>→</span>
              </Button>
              <p className="mt-2 text-center text-xs text-black/50">
                {overTop
                  ? `${shop.businessName} prices up to ${sorted[sorted.length - 1]?.quantity.toLocaleString()} pcs here — ask them for a price on more.`
                  : 'The printer will send you a price to approve before you pay.'}
              </p>
            </>
          )}
        </div>

        <p className="mt-3 text-[13px] text-black/50">
          <Link href={`/${shop.slug}`} className="font-semibold text-blue hover:underline">See full storefront</Link>
          {shop.area ? ` · ${shop.area}` : ''}
        </p>
      </div>
    </div>
  );
}
