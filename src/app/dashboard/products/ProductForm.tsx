'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { RotateCcw, Trash2 } from 'lucide-react';
import { LIVE_CATEGORIES, getCategory, getListing, gridCells, cellKey } from '@/lib/categories';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select } from '@/components/ui/Field';
import { saveProduct, type ProductPayload } from './actions';

/**
 * Printer pricing form, rebuilt for QA Round 1.
 *
 *  QA 1.3 — the Product name field is gone platform-wide; the name is derived server-side.
 *  QA 1.4 — the unlabeled "e.g. matte, single side" field is gone.
 *  QA 1.5 — grids auto-generate every combination. The printer fills prices and deletes the
 *           rows they do not offer; anything blank or deleted falls back to Request Quote.
 *  QA 3.4 — each listing (Standard vs Rounded, Round Cut vs Straight Cut) is its own product
 *           with its own grid, so the listing picker sits right under the category picker.
 */

export type InitialProduct = {
  id?: string;
  categorySlug: string;
  listingSlug: string;
  pricingMode: string;
  ratePerUnit: string;   // naira strings in the form; kobo in the DB
  offersHylet: boolean;
  turnaroundHours: string;
  photoUrl: string;
  /** key = cellKey(grid, coords) */
  cellPrices: Record<string, string>;
  addonPrices: Record<string, string>;   // key = `${kind}::${label}`
};

const BASIS_LABEL: Record<string, string> = { per_piece: 'per piece', per_sheet: 'per sheet', flat: 'flat' };

export function ProductForm({ initial }: { initial: InitialProduct }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [categorySlug, setCategorySlug] = useState(initial.categorySlug);
  const [listingSlug, setListingSlug] = useState(initial.listingSlug);
  const [mode, setMode] = useState(initial.pricingMode || 'quote');
  const [rate, setRate] = useState(initial.ratePerUnit);
  const [offersHylet, setOffersHylet] = useState(initial.offersHylet);
  const [turnaround, setTurnaround] = useState(initial.turnaroundHours || '24');
  const [photoUrl, setPhotoUrl] = useState(initial.photoUrl);
  const [cellPrices, setCellPrices] = useState<Record<string, string>>(initial.cellPrices);
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [addonPrices, setAddonPrices] = useState<Record<string, string>>(initial.addonPrices);

  const cat = getCategory(categorySlug);
  const listing = cat ? getListing(cat, listingSlug) ?? cat.listings[0] : undefined;
  const grid = listing?.pricingGrid;
  const perArea = Boolean(listing?.perAreaRate);

  // Request Quote is always available as a secondary option (QA 3.8 / 3.9).
  const modes = useMemo(() => {
    const out: { value: string; label: string; hint: string }[] = [];
    if (perArea) out.push({ value: 'per_area', label: 'Per sq.ft', hint: 'Width × height auto-calculates the price' });
    if (grid) {
      out.push({
        value: 'matrix',
        label: 'Price grid',
        hint: grid.priceType === 'per_piece' ? 'Rate per piece for each combination' : 'Flat batch price for each combination',
      });
    }
    out.push({ value: 'quote', label: 'Request quote', hint: 'No price shown — customers send a request' });
    return out;
  }, [grid, perArea]);

  const validMode = modes.some((m) => m.value === mode) ? mode : modes[0].value;
  const cells = useMemo(() => (grid ? gridCells(grid) : []), [grid]);

  function switchCategory(slug: string) {
    const next = getCategory(slug);
    setCategorySlug(slug);
    setListingSlug(next?.listings[0]?.slug ?? '');
    setMode('');
    setCellPrices({});
    setRemoved(new Set());
    setAddonPrices({});
  }

  function switchListing(slug: string) {
    setListingSlug(slug);
    setMode('');
    setCellPrices({});
    setRemoved(new Set());
    setAddonPrices({});
  }

  function submit() {
    setError(null);
    if (!cat || !listing) { setError('Pick a product first.'); return; }

    const payload: ProductPayload = {
      id: initial.id,
      categorySlug,
      listingSlug: listing.slug,
      pricingMode: validMode,
      ratePerUnit: validMode === 'per_area' ? rate : '',
      offersHylet: perArea ? offersHylet : false,
      turnaroundHours: turnaround,
      photoUrl: photoUrl.trim(),
      cells: validMode === 'matrix' && grid
        ? cells
            .filter((c) => !removed.has(cellKey(grid, c)))
            .map((c) => ({ coords: c, price: cellPrices[cellKey(grid, c)] ?? '' }))
            .filter((c) => c.price)
        : [],
      addons: validMode !== 'quote'
        ? (listing.fixedAddons ?? [])
            .map((a) => ({ ...a, price: addonPrices[`${a.kind}::${a.label}`] ?? '' }))
            .filter((a) => a.price)
        : [],
    };

    start(async () => {
      const res = await saveProduct(payload);
      if (res?.error) { setError(res.error); return; }
      router.push('/dashboard/products');
      router.refresh();
    });
  }

  const priceInput = (v: string, set: (s: string) => void, ph = '0') => (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-sm text-black/40">₦</span>
      <Input inputMode="numeric" value={v} onChange={(e) => set(e.target.value.replace(/[^\d]/g, ''))} placeholder={ph} className="!pl-7" />
    </div>
  );

  const filledCount = grid
    ? cells.filter((c) => !removed.has(cellKey(grid, c)) && cellPrices[cellKey(grid, c)]).length
    : 0;

  return (
    <div className="max-w-3xl space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Product">
          <Select value={categorySlug} onChange={(e) => switchCategory(e.target.value)}>
            {LIVE_CATEGORIES.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
          </Select>
        </Field>
        {cat && cat.listings.length > 1 && (
          <Field label="Type" hint="Each type is priced separately.">
            <Select value={listingSlug} onChange={(e) => switchListing(e.target.value)}>
              {cat.listings.map((l) => <option key={l.slug} value={l.slug}>{l.label}</option>)}
            </Select>
          </Field>
        )}
      </div>

      <div>
        <span className="mb-2.5 block font-display text-[13px] font-bold text-navy">Pricing mode</span>
        <div className="space-y-2" role="radiogroup" aria-label="Pricing mode">
          {modes.map((m) => (
            <button
              key={m.value}
              role="radio"
              aria-checked={validMode === m.value}
              onClick={() => setMode(m.value)}
              className={`flex w-full items-baseline justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition-colors ${
                validMode === m.value ? 'border-blue bg-blue text-white' : 'border-black/15 text-navy hover:border-black/35'
              }`}
            >
              <span className="font-display text-sm font-extrabold">{m.label}</span>
              <span className={`text-xs ${validMode === m.value ? 'text-white/75' : 'text-black/45'}`}>{m.hint}</span>
            </button>
          ))}
        </div>
      </div>

      {validMode === 'per_area' && (
        <>
          {/* QA 3.1: no unit dropdown — sq.ft is the only unit — and no minimum charge field. */}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Rate">{priceInput(rate, setRate, '1800')}</Field>
            <Field label="Per">
              <div className="flex h-11 items-center rounded-xl border border-black/15 px-3.5 font-mono text-sm font-bold text-navy">
                sq.ft
              </div>
            </Field>
          </div>
          <p className="text-xs text-black/45">
            No price floor — if a custom size comes in too small to be worth printing, reject the job from your queue.
          </p>
        </>
      )}

      {validMode === 'per_area' && listing?.optionAxes?.some((a) => a.key === 'hylet') && (
        <div className="flex items-center justify-between rounded-2xl border border-black/12 p-4">
          <div>
            <p className="font-display text-[13px] font-bold text-navy">Do you offer hylet?</p>
            <p className="mt-0.5 text-xs text-black/50">Always free to the customer — there is no price to set.</p>
          </div>
          <div className="flex gap-1 rounded-pill bg-black/5 p-0.5">
            {[true, false].map((v) => (
              <button
                key={String(v)}
                onClick={() => setOffersHylet(v)}
                className={`rounded-pill px-4 py-1.5 font-display text-xs font-bold ${offersHylet === v ? 'bg-navy text-white' : 'text-navy'}`}
              >
                {v ? 'Yes' : 'No'}
              </button>
            ))}
          </div>
        </div>
      )}

      {validMode === 'matrix' && grid && (
        <div>
          <div className="mb-1 flex items-baseline justify-between gap-3">
            <span className="font-display text-[13px] font-bold text-navy">
              Price grid — {grid.priceType === 'per_piece' ? 'rate per piece' : 'total per batch'}
            </span>
            <span className="font-mono text-[11px] font-bold text-black/45">{filledCount}/{cells.length} priced</span>
          </div>
          <p className="mb-3 text-xs text-black/50">
            {grid.priceType === 'per_piece'
              ? 'Enter what you charge for ONE piece in each combination.'
              : 'Enter the TOTAL you charge for that whole batch, not the price of one piece.'}
            {' '}Leave a row blank or delete it and that combination shows as Request Quote.
          </p>

          <div className="overflow-hidden rounded-2xl border border-black/12">
            <div
              className="grid items-center gap-2 border-b border-black/10 bg-black/[0.03] px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-widest text-black/50"
              style={{ gridTemplateColumns: `repeat(${grid.axes.length}, minmax(0,1fr)) 140px 32px` }}
            >
              {grid.axes.map((a) => <span key={a.key}>{a.label}</span>)}
              <span>Price</span>
              <span className="sr-only">Remove</span>
            </div>

            {cells.map((c) => {
              const key = cellKey(grid, c);
              const gone = removed.has(key);
              return (
                <div
                  key={key}
                  className={`grid items-center gap-2 border-b border-black/8 px-3 py-2 last:border-0 ${gone ? 'opacity-40' : ''}`}
                  style={{ gridTemplateColumns: `repeat(${grid.axes.length}, minmax(0,1fr)) 140px 32px` }}
                >
                  {grid.axes.map((a) => (
                    <span key={a.key} className={`font-mono text-[12px] font-bold text-navy ${gone ? 'line-through' : ''}`}>
                      {String(c[a.key])}
                    </span>
                  ))}
                  {gone ? (
                    <span className="font-mono text-[11px] text-black/45">Request quote</span>
                  ) : (
                    priceInput(cellPrices[key] ?? '', (v) => setCellPrices((p) => ({ ...p, [key]: v })))
                  )}
                  <button
                    aria-label={gone ? 'Restore row' : 'Remove row'}
                    onClick={() => setRemoved((prev) => {
                      const next = new Set(prev);
                      if (next.has(key)) next.delete(key); else next.add(key);
                      return next;
                    })}
                    className="text-black/35 hover:text-red"
                  >
                    {gone ? <RotateCcw className="size-4" /> : <Trash2 className="size-4" />}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* QA 3.3: Flyer's three add-ons are pre-populated. No other product has add-ons at all. */}
      {validMode !== 'quote' && (listing?.fixedAddons?.length ?? 0) > 0 && (
        <div>
          <span className="mb-1 block font-display text-[13px] font-bold text-navy">Add-on pricing</span>
          <p className="mb-2.5 text-xs text-black/45">
            Leave one blank if you don&apos;t offer it — customers who pick it will see Request Quote.
          </p>
          <div className="space-y-2">
            {(listing?.fixedAddons ?? []).map((a) => {
              const key = `${a.kind}::${a.label}`;
              return (
                <div key={key} className="grid grid-cols-[1fr_140px_90px] items-center gap-2">
                  <span className="font-display text-sm font-bold text-navy">{a.label}</span>
                  {priceInput(addonPrices[key] ?? '', (v) => setAddonPrices((p) => ({ ...p, [key]: v })), '50')}
                  <span className="font-mono text-[11px] text-black/45">{BASIS_LABEL[a.basis]}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Turnaround (hours)">
          <Input inputMode="numeric" value={turnaround} onChange={(e) => setTurnaround(e.target.value.replace(/\D/g, ''))} />
        </Field>
        <Field label="Photo URL (optional)" hint="Real photos of your work build trust — icons are the fallback.">
          <Input value={photoUrl} onChange={(e) => setPhotoUrl(e.target.value)} placeholder="https://…" />
        </Field>
      </div>

      {error && <p className="rounded-xl border border-red/30 bg-red/5 px-3.5 py-2.5 text-sm text-red">{error}</p>}

      <Button onClick={submit} disabled={pending} className="w-full sm:w-auto">
        {pending ? 'Saving…' : initial.id ? 'Save changes' : 'Publish product'} <span aria-hidden>→</span>
      </Button>
    </div>
  );
}
