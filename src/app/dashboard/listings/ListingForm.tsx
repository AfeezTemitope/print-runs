'use client';

import { useState, useTransition } from 'react';
import Image from 'next/image';
import { Trash2, X } from 'lucide-react';
import { LIVE_CATEGORIES, MAX_TIERS, PRICING_MODES, SUGGESTED_MODE, type PricingMode } from '@/lib/catalog';
import { naira } from '@/lib/format';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select, Textarea } from '@/components/ui/Field';
import { PhotoUpload } from '@/components/ui/PhotoUpload';
import { saveListing, deleteListing, type ListingInput } from './actions';

export type Sub = { id: string; categorySlug: string; name: string };
export type ListingRow = ListingInput & { id: string };

const emptyTiers = () => [
  { quantity: '', price: '' },
  { quantity: '', price: '' },
  { quantity: '', price: '' },
];

export function ListingForm({
  listing, subs, onDone,
}: { listing: ListingRow | null; subs: Sub[]; onDone: () => void }) {
  const [categorySlug, setCategorySlug] = useState(listing?.categorySlug ?? LIVE_CATEGORIES[0].slug);
  const [subcategoryId, setSubcategoryId] = useState(listing?.subcategoryId ?? '');
  const [name, setName] = useState(listing?.name ?? '');
  const [description, setDescription] = useState(listing?.description ?? '');
  const [photos, setPhotos] = useState<string[]>(listing?.photos ?? []);
  const [pricingMode, setPricingMode] = useState<PricingMode>(listing?.pricingMode ?? SUGGESTED_MODE[categorySlug] ?? 'tier');
  const [tiers, setTiers] = useState(() => {
    const base = emptyTiers();
    (listing?.tiers ?? []).forEach((t, i) => { if (i < MAX_TIERS) base[i] = t; });
    return base;
  });
  const [ratePerPiece, setRatePerPiece] = useState(listing?.ratePerPiece ?? '');
  const [ratePerArea, setRatePerArea] = useState(listing?.ratePerArea ?? '');
  const [areaUnit, setAreaUnit] = useState<'sqft' | 'sqin'>(listing?.areaUnit ?? 'sqft');
  const [minCharge, setMinCharge] = useState(listing?.minCharge ?? '');
  const [minimumOrder, setMinimumOrder] = useState(listing?.minimumOrder ?? '');
  const [turnaround, setTurnaround] = useState(listing?.turnaround ?? '24');

  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const catSubs = subs.filter((s) => s.categorySlug === categorySlug);
  const suggested = SUGGESTED_MODE[categorySlug];

  function money(value: string, set: (s: string) => void, placeholder = '0') {
    return (
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-sm text-black/40">₦</span>
        <Input inputMode="numeric" value={value} placeholder={placeholder}
          onChange={(e) => set(e.target.value.replace(/[^\d]/g, ''))} className="!pl-7" />
      </div>
    );
  }

  function submit() {
    setError(null);
    start(async () => {
      const res = await saveListing({
        id: listing?.id,
        categorySlug, subcategoryId, name, description, photos,
        pricingMode, tiers, ratePerPiece, ratePerArea, areaUnit,
        minCharge, minimumOrder, turnaround,
        isActive: listing?.isActive ?? true,
      });
      if (res?.error) setError(res.error);
      else onDone();
    });
  }

  return (
    <div className="space-y-5 rounded-2xl border border-black/12 bg-white p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Category">
          <Select value={categorySlug} onChange={(e) => {
            setCategorySlug(e.target.value);
            setSubcategoryId('');
            if (!listing) setPricingMode(SUGGESTED_MODE[e.target.value] ?? 'tier');
          }}>
            {LIVE_CATEGORIES.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
          </Select>
        </Field>
        <Field label="Sub-category" hint={catSubs.length ? undefined : 'Add one first in Sub-categories.'}>
          <Select value={subcategoryId} onChange={(e) => setSubcategoryId(e.target.value)}>
            <option value="">— none —</option>
            {catSubs.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
        </Field>
      </div>

      <Field label="Product name" hint="Name it the way you'd say it to a customer.">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="3×3 Brand Print & Cut Circle Sticker" />
      </Field>

      <Field label="Description" hint="Your own words — what it's made of, what it's good for.">
        <Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)}
          placeholder="Waterproof vinyl sticker, clean die-cut finish." />
      </Field>

      <div>
        <span className="mb-2 block font-display text-[13px] font-bold text-navy">Photos</span>
        <p className="mb-2 text-xs text-black/50">Up to 3. Real photos of your own work sell far better than icons.</p>
        <div className="grid grid-cols-3 gap-3">
          {photos.map((url, i) => (
            <div key={url} className="relative aspect-square overflow-hidden rounded-xl border border-black/12">
              <Image src={url} alt={`Photo ${i + 1}`} fill sizes="200px" className="object-cover" />
              <button aria-label="Remove photo" onClick={() => setPhotos((p) => p.filter((u) => u !== url))}
                className="absolute right-2 top-2 grid size-7 place-items-center rounded-pill bg-black/60 text-white hover:bg-red">
                <X className="size-3.5" />
              </button>
            </div>
          ))}
          {photos.length < 3 && (
            <PhotoUpload kind="products" label="Product photo" aspect="aspect-square"
              onChange={(url) => { if (url) setPhotos((p) => [...p, url].slice(0, 3)); }} />
          )}
        </div>
      </div>

      <div>
        <span className="mb-1 block font-display text-[13px] font-bold text-navy">How do you price this?</span>
        <p className="mb-2.5 text-xs text-black/50">
          Pick whichever matches how you actually think about this product — you&apos;re not locked
          into one by category.
        </p>
        <div className="space-y-2">
          {PRICING_MODES.map((m) => (
            <button key={m.value} onClick={() => setPricingMode(m.value)}
              className={`flex w-full items-baseline justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition-colors ${
                pricingMode === m.value ? 'border-blue bg-blue text-white' : 'border-black/15 text-navy hover:border-black/35'
              }`}>
              <span className="font-display text-sm font-extrabold">
                {m.label}
                {suggested === m.value && (
                  <span className={`ml-2 font-mono text-[10px] font-bold uppercase tracking-widest ${
                    pricingMode === m.value ? 'text-white/70' : 'text-black/40'
                  }`}>
                    most common here
                  </span>
                )}
              </span>
              <span className={`text-xs ${pricingMode === m.value ? 'text-white/75' : 'text-black/45'}`}>{m.hint}</span>
            </button>
          ))}
        </div>
      </div>

      {pricingMode === 'tier' && (
        <div>
          <span className="mb-1 block font-display text-[13px] font-bold text-navy">Quantity tiers</span>
          <p className="mb-2.5 text-xs text-black/50">
            Up to {MAX_TIERS}. Enter the TOTAL for that whole batch. A customer who wants more than
            your largest tier is sent to Request Quote instead of being given a guessed price.
          </p>
          <div className="space-y-2">
            {tiers.map((t, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr] gap-2">
                <Input inputMode="numeric" value={t.quantity} placeholder={`Qty ${i + 1}`}
                  onChange={(e) => setTiers((rows) => rows.map((r, j) => j === i ? { ...r, quantity: e.target.value.replace(/\D/g, '') } : r))} />
                {money(t.price, (v) => setTiers((rows) => rows.map((r, j) => j === i ? { ...r, price: v } : r)), 'Total price')}
              </div>
            ))}
          </div>
        </div>
      )}

      {pricingMode === 'piece' && (
        <Field label="Rate per piece" hint="The customer enters any quantity and the total updates instantly.">
          {money(ratePerPiece, setRatePerPiece, '250')}
        </Field>
      )}

      {pricingMode === 'area' && (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Rate">{money(ratePerArea, setRatePerArea, '1800')}</Field>
            <Field label="Per">
              <Select value={areaUnit} onChange={(e) => setAreaUnit(e.target.value as 'sqft' | 'sqin')}>
                <option value="sqft">sq.ft</option>
                <option value="sqin">sq.in</option>
              </Select>
            </Field>
          </div>
          <Field label="Minimum charge (optional)">
            {money(minCharge, setMinCharge, '5000')}
          </Field>
          {/* Copy mandated by the spec, with the currency corrected to naira. */}
          <p className="-mt-2 rounded-xl bg-pale/40 px-4 py-3 text-[13px] leading-relaxed text-navy">
            Set a minimum charge if you have a base cost regardless of size. For example, if your
            minimum job is ₦5,000, a customer ordering a very small banner will still pay at least
            ₦5,000 even if the sq.ft calculation comes out lower.
          </p>
        </>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Minimum order (optional)" hint="e.g. 50 pcs">
          <Input inputMode="numeric" value={minimumOrder} placeholder="50"
            onChange={(e) => setMinimumOrder(e.target.value.replace(/\D/g, ''))} />
        </Field>
        <Field label="Turnaround (hours)" hint="Set per product — your stickers and jotters can differ.">
          <Input inputMode="numeric" value={turnaround}
            onChange={(e) => setTurnaround(e.target.value.replace(/\D/g, ''))} />
        </Field>
      </div>

      {error && <p className="rounded-xl border border-red/30 bg-red/5 px-3.5 py-2.5 text-sm text-red">{error}</p>}

      <div className="flex flex-wrap items-center gap-2 border-t border-dashed border-black/20 pt-4">
        <Button size="sm" disabled={pending} onClick={submit}>
          {pending ? 'Saving…' : listing ? 'Save changes' : 'Add product'}
        </Button>
        <Button size="sm" variant="tertiary" onClick={onDone}>Cancel</Button>
        {listing && (
          <button aria-label="Delete listing" className="ml-auto text-black/35 hover:text-red"
            onClick={() => start(async () => { await deleteListing(listing.id); onDone(); })}>
            <Trash2 className="size-4" />
          </button>
        )}
      </div>
    </div>
  );
}
