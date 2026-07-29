'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2 } from 'lucide-react';
import { CATEGORIES, getCategory } from '@/lib/categories';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select } from '@/components/ui/Field';
import { saveProduct, type ProductPayload } from './actions';

/**
 * Screen 3 + §4.2 (spec): the form changes shape with the pricing mode.
 *  Per ft/sq.ft — rate (+ min charge)
 *  Quantity tier — repeatable qty/price/label rows
 *  Request quote — nothing to price
 * Plus fixed sizes (frames) and the
 * jotter matrix. Add-ons are one shared component priced per option (§6).
 */

type TierRow = { qty: string; price: string; label: string };
type MatrixRow = { cover: string; size: string; sheets: string; price: string };
type AddonRow = { kind: string; label: string; basis: string; price: string };

export type InitialProduct = {
  id?: string;
  categorySlug: string;
  name: string;
  pricingMode: string;
  areaUnit: string | null;
  ratePerUnit: string;   // naira strings in the form; kobo in the DB
  minCharge: string;
  turnaroundHours: string;
  photoUrl: string;
  tiers: TierRow[];
  matrix: MatrixRow[];
  addons: AddonRow[];
};

const MODES_BY_CATEGORY: Record<string, { value: string; label: string; hint: string }[]> = {
  sticker: [
    { value: 'per_area', label: 'Per sq.ft / sq.in', hint: 'Large single stickers — size × rate' },
    { value: 'tier', label: 'Quantity tier', hint: 'Bulk small stickers — flat price per batch' },
    { value: 'quote', label: 'Request quote', hint: 'No price shown — customers send a request' },
  ],
  banner: [
    { value: 'per_area', label: 'Per sq.ft', hint: 'Width × height auto-calculates the price' },
    { value: 'quote', label: 'Request quote', hint: 'No price shown' },
  ],
  flyer: [
    { value: 'tier', label: 'Quantity tier', hint: 'e.g. 100pcs = ₦X' },
    { value: 'quote', label: 'Request quote', hint: 'No price shown' },
  ],
  business_card: [
    { value: 'tier', label: 'Print + Cut — quantity tiers', hint: 'Finished cards' },
    { value: 'quote', label: 'Request quote', hint: 'No price shown' },
  ],
  nylon: [
    { value: 'tier', label: 'Quantity tier', hint: 'Per batch' },
    { value: 'quote', label: 'Request quote', hint: 'No price shown' },
  ],
  jotter: [
    { value: 'matrix', label: 'Price matrix', hint: 'Cover × size × sheet count' },
    { value: 'quote', label: 'Request quote', hint: 'No price shown' },
  ],
  frame: [
    { value: 'fixed_size', label: 'Price per size', hint: 'A4 / A3 / A2 — closed list' },
    { value: 'quote', label: 'Request quote', hint: 'No price shown' },
  ],
};

const BASIS_LABEL: Record<string, string> = { per_piece: 'per piece', per_sheet: 'per sheet', flat: 'flat' };

export function ProductForm({ initial }: { initial: InitialProduct }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [category, setCategory] = useState(initial.categorySlug);
  const modes = MODES_BY_CATEGORY[category] ?? [{ value: 'quote', label: 'Request quote', hint: '' }];
  const [mode, setMode] = useState(initial.pricingMode || modes[0].value);
  const [name, setName] = useState(initial.name);
  const [areaUnit, setAreaUnit] = useState(initial.areaUnit ?? 'sqft');
  const [rate, setRate] = useState(initial.ratePerUnit);
  const [minCharge, setMinCharge] = useState(initial.minCharge);
  const [turnaround, setTurnaround] = useState(initial.turnaroundHours || '24');
  const [photoUrl, setPhotoUrl] = useState(initial.photoUrl);
  const [tiers, setTiers] = useState<TierRow[]>(initial.tiers.length ? initial.tiers : [{ qty: '100', price: '', label: '' }]);
  const [matrix, setMatrix] = useState<MatrixRow[]>(initial.matrix.length ? initial.matrix : [{ cover: 'Soft cover', size: 'A5', sheets: '40', price: '' }]);
  const [addons, setAddons] = useState<AddonRow[]>(initial.addons);

  const cat = getCategory(category);
  const validMode = modes.some((m) => m.value === mode) ? mode : modes[0].value;
  const fixedSizes = cat?.fixedSizes ?? [];
  const jotter = cat?.jotter;

  const addonKinds = useMemo(() => {
    const axes = cat?.addonAxes ?? [];
    return axes.map((a) => ({
      kind: a.kind,
      // paid options only — the first option of every axis is the free default
      options: a.options.slice(1),
    })).filter((a) => a.options.length);
  }, [cat]);

  function submit() {
    setError(null);
    const payload: ProductPayload = {
      id: initial.id,
      categorySlug: category,
      name: name.trim() || `${cat?.name ?? category}`,
      pricingMode: validMode,
      areaUnit: validMode === 'per_area' ? areaUnit : null,
      ratePerUnit: rate,
      minCharge,
      turnaroundHours: turnaround,
      photoUrl: photoUrl.trim(),
      tiers: validMode === 'tier'
        ? tiers
        : validMode === 'fixed_size'
          ? fixedSizes.map((s) => ({ qty: '1', price: tiers.find((t) => t.label === s)?.price ?? '', label: s }))
          : [],
      matrix: validMode === 'matrix' ? matrix : [],
      addons,
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

  return (
    <div className="max-w-2xl space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Category">
          <Select value={category} onChange={(e) => { setCategory(e.target.value); setMode(MODES_BY_CATEGORY[e.target.value]?.[0].value ?? 'quote'); }}>
            {CATEGORIES.filter((c) => c.live).map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
          </Select>
        </Field>
        <Field label="Product name">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={`e.g. ${cat?.name ?? 'Product'}`} />
        </Field>
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
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Rate">{priceInput(rate, setRate, '1800')}</Field>
          <Field label="Per">
            <Select value={areaUnit} onChange={(e) => setAreaUnit(e.target.value)}>
              <option value="sqft">sq.ft</option><option value="sqin">sq.inch</option>
            </Select>
          </Field>
          <Field label="Minimum charge" hint="Optional floor per piece">{priceInput(minCharge, setMinCharge)}</Field>
        </div>
      )}

      {validMode === 'tier' && (
        <div>
          <span className="mb-2.5 block font-display text-[13px] font-bold text-navy">Quantity tiers</span>
          <div className="space-y-2">
            {tiers.map((t, i) => (
              <div key={i} className="grid grid-cols-[90px_1fr_1fr_36px] items-center gap-2">
                <Input inputMode="numeric" aria-label="Quantity" value={t.qty}
                  onChange={(e) => setTiers(tiers.map((x, j) => (j === i ? { ...x, qty: e.target.value.replace(/\D/g, '') } : x)))} placeholder="100" />
                {priceInput(t.price, (v) => setTiers(tiers.map((x, j) => (j === i ? { ...x, price: v } : x))), '20000')}
                <Input aria-label="Variant label (optional)" value={t.label}
                  onChange={(e) => setTiers(tiers.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} placeholder="e.g. matte, single side" />
                <button aria-label="Remove tier" onClick={() => setTiers(tiers.filter((_, j) => j !== i))} className="text-black/35 hover:text-red" disabled={tiers.length === 1}>
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))}
          </div>
          <Button variant="tertiary" size="sm" className="mt-2.5" onClick={() => setTiers([...tiers, { qty: '', price: '', label: '' }])}>
            <Plus className="size-4" /> Add tier
          </Button>
        </div>
      )}

      {validMode === 'fixed_size' && (
        <div>
          <span className="mb-2.5 block font-display text-[13px] font-bold text-navy">Price per size</span>
          <div className="space-y-2">
            {fixedSizes.map((s) => (
              <div key={s} className="grid grid-cols-[70px_1fr] items-center gap-3">
                <span className="font-mono text-sm font-bold text-navy">{s}</span>
                {priceInput(
                  tiers.find((t) => t.label === s)?.price ?? '',
                  (v) => setTiers((prev) => {
                    const others = prev.filter((t) => t.label !== s);
                    return [...others, { qty: '1', price: v, label: s }];
                  }),
                )}
              </div>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-black/45">Leave a size empty to not offer it — those requests fall back to quote.</p>
        </div>
      )}

      {validMode === 'matrix' && jotter && (
        <div>
          <span className="mb-2.5 block font-display text-[13px] font-bold text-navy">Price matrix (per piece)</span>
          <div className="space-y-2">
            {matrix.map((r, i) => (
              <div key={i} className="grid grid-cols-[1fr_80px_100px_1fr_36px] items-center gap-2">
                <Select aria-label="Cover" value={r.cover} onChange={(e) => setMatrix(matrix.map((x, j) => (j === i ? { ...x, cover: e.target.value } : x)))}>
                  {jotter.covers.map((c) => <option key={c}>{c}</option>)}
                </Select>
                <Select aria-label="Size" value={r.size} onChange={(e) => setMatrix(matrix.map((x, j) => (j === i ? { ...x, size: e.target.value } : x)))}>
                  {jotter.sizes.map((c) => <option key={c}>{c}</option>)}
                </Select>
                <Select aria-label="Sheets" value={r.sheets} onChange={(e) => setMatrix(matrix.map((x, j) => (j === i ? { ...x, sheets: e.target.value } : x)))}>
                  {jotter.sheets.map((c) => <option key={c} value={String(c)}>{c} sh</option>)}
                </Select>
                {priceInput(r.price, (v) => setMatrix(matrix.map((x, j) => (j === i ? { ...x, price: v } : x))))}
                <button aria-label="Remove row" onClick={() => setMatrix(matrix.filter((_, j) => j !== i))} className="text-black/35 hover:text-red" disabled={matrix.length === 1}>
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))}
          </div>
          <Button variant="tertiary" size="sm" className="mt-2.5" onClick={() => setMatrix([...matrix, { cover: jotter.covers[0], size: jotter.sizes[0], sheets: String(jotter.sheets[0]), price: '' }])}>
            <Plus className="size-4" /> Add row
          </Button>
        </div>
      )}

      {validMode !== 'quote' && addonKinds.length > 0 && (
        <div>
          <span className="mb-1 block font-display text-[13px] font-bold text-navy">Add-on pricing</span>
          <p className="mb-2.5 text-xs text-black/45">
            Price the options you offer. Any option a customer picks that you haven&apos;t priced falls back to Request Quote.
          </p>
          <div className="space-y-2">
            {addons.map((a, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr_110px_36px] items-center gap-2">
                <Select aria-label="Option" value={`${a.kind}::${a.label}`}
                  onChange={(e) => {
                    const [kind, label] = e.target.value.split('::');
                    setAddons(addons.map((x, j) => (j === i ? { ...x, kind, label } : x)));
                  }}>
                  {addonKinds.flatMap((k) => k.options.map((o) => (
                    <option key={`${k.kind}::${o}`} value={`${k.kind}::${o}`}>{o}</option>
                  )))}
                </Select>
                {priceInput(a.price, (v) => setAddons(addons.map((x, j) => (j === i ? { ...x, price: v } : x))), '500')}
                <Select aria-label="Basis" value={a.basis} onChange={(e) => setAddons(addons.map((x, j) => (j === i ? { ...x, basis: e.target.value } : x)))}>
                  {Object.entries(BASIS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </Select>
                <button aria-label="Remove add-on" onClick={() => setAddons(addons.filter((_, j) => j !== i))} className="text-black/35 hover:text-red">
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))}
          </div>
          <Button variant="tertiary" size="sm" className="mt-2.5"
            onClick={() => setAddons([...addons, { kind: addonKinds[0].kind, label: addonKinds[0].options[0], basis: 'per_piece', price: '' }])}>
            <Plus className="size-4" /> Price an add-on
          </Button>
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
