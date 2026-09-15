'use client';

import { useState, useTransition } from 'react';
import Image from 'next/image';
import { Eye, EyeOff, Plus } from 'lucide-react';
import { LIVE_CATEGORIES, MAX_CUSTOM_SUBCATEGORIES, getCategory } from '@/lib/catalog';
import { naira } from '@/lib/format';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Field';
import { ListingForm, type ListingRow, type Sub } from './ListingForm';
import { addSubcategory, deleteSubcategory, toggleListing } from './actions';

export type ListingCard = ListingRow & { fromKobo: number | null; subName: string | null };

const MODE_LABEL = { tier: 'Quantity tiers', piece: 'Per piece', area: 'Per area', quote: 'Request quote' } as const;

export function ListingsClient({ subs, listings }: { subs: Sub[]; listings: ListingCard[] }) {
  const [editing, setEditing] = useState<ListingRow | null>(null);
  const [adding, setAdding] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Sub-category composer
  const [subCat, setSubCat] = useState(LIVE_CATEGORIES[0].slug);
  const [customName, setCustomName] = useState('');

  const category = getCategory(subCat);
  const mine = subs.filter((s) => s.categorySlug === subCat);
  const unused = (category?.suggested ?? []).filter((n) => !mine.some((s) => s.name === n));
  const customCount = subs.filter((s) => (s as Sub & { isCustom?: boolean }).isCustom).length;

  function run(fn: () => Promise<{ error?: string } | void>) {
    setError(null);
    start(async () => {
      const res = await fn();
      if (res && 'error' in res && res.error) setError(res.error);
    });
  }

  if (editing || adding) {
    return (
      <ListingForm
        listing={editing}
        subs={subs}
        onDone={() => { setEditing(null); setAdding(false); }}
      />
    );
  }

  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-1 font-display text-xl font-extrabold text-navy">Sub-categories</h2>
        <p className="mb-3 text-[13px] text-black/55">
          How your products are grouped on your storefront. Use ours or name your own —
          {' '}{MAX_CUSTOM_SUBCATEGORIES - customCount} custom {MAX_CUSTOM_SUBCATEGORIES - customCount === 1 ? 'slot' : 'slots'} left.
        </p>

        <div className="rounded-2xl border border-black/12 bg-white p-4">
          <Select value={subCat} onChange={(e) => setSubCat(e.target.value)} aria-label="Category">
            {LIVE_CATEGORIES.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
          </Select>

          {mine.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-2">
              {mine.map((s) => (
                <li key={s.id} className="flex items-center gap-1.5 rounded-pill border border-black/15 px-3 py-1.5">
                  <span className="font-display text-[13px] font-bold text-navy">{s.name}</span>
                  <button aria-label={`Remove ${s.name}`} className="text-black/30 hover:text-red"
                    onClick={() => run(() => deleteSubcategory(s.id))}>×</button>
                </li>
              ))}
            </ul>
          )}

          {unused.length > 0 && (
            <>
              <p className="mt-3 font-mono text-[10px] font-bold uppercase tracking-widest text-black/45">Suggestions</p>
              <ul className="mt-1.5 flex flex-wrap gap-2">
                {unused.map((n) => (
                  <li key={n}>
                    <button disabled={pending} onClick={() => run(() => addSubcategory(subCat, n, false))}
                      className="rounded-pill border border-dashed border-black/25 px-3 py-1.5 font-display text-[13px] font-bold text-navy hover:border-blue hover:text-blue">
                      + {n}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}

          <div className="mt-3 flex gap-2">
            <Input value={customName} onChange={(e) => setCustomName(e.target.value)}
              placeholder="Or type your own…" aria-label="Custom sub-category" />
            <Button size="sm" variant="tertiary" disabled={pending || customName.trim().length < 2}
              onClick={() => run(async () => {
                const res = await addSubcategory(subCat, customName, true);
                if (!(res && 'error' in res && res.error)) setCustomName('');
                return res;
              })}>
              Add
            </Button>
          </div>
        </div>
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-extrabold text-navy">Products</h2>
            <p className="text-[13px] text-black/55">{listings.length} listing{listings.length === 1 ? '' : 's'}</p>
          </div>
          <Button size="sm" onClick={() => setAdding(true)}>
            <Plus className="size-4" /> New product
          </Button>
        </div>

        {!listings.length ? (
          <p className="rounded-2xl border border-dashed border-black/20 bg-white/60 px-5 py-8 text-center text-black/55">
            No products yet. Customers can&apos;t find you in search until you list at least one.
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {listings.map((l) => (
              <li key={l.id} className={`overflow-hidden rounded-2xl border bg-white ${l.isActive ? 'border-black/12' : 'border-dashed border-black/20 opacity-70'}`}>
                <div className="relative aspect-[4/3] bg-pale/30">
                  {l.photos[0] && <Image src={l.photos[0]} alt={l.name} fill sizes="320px" className="object-cover" />}
                </div>
                <div className="p-4">
                  <p className="font-display font-extrabold text-navy">{l.name}</p>
                  <p className="mt-0.5 text-xs text-black/50">
                    {getCategory(l.categorySlug)?.name}
                    {l.subName ? ` · ${l.subName}` : ''}
                    {' · '}{MODE_LABEL[l.pricingMode]}
                  </p>
                  <p className="mt-1.5 font-display text-[15px] font-extrabold text-navy">
                    {l.fromKobo !== null ? `From ${naira(l.fromKobo)}` : 'No price set'}
                    {l.minimumOrder ? <span className="ml-1 font-mono text-[11px] font-bold text-black/45">Min {l.minimumOrder}</span> : null}
                  </p>
                  <div className="mt-3 flex items-center gap-2 border-t border-dashed border-black/20 pt-3">
                    <Button size="sm" variant="tertiary" onClick={() => setEditing(l)}>Edit</Button>
                    <button aria-label={l.isActive ? 'Hide from customers' : 'Show to customers'}
                      className="ml-auto flex items-center gap-1.5 font-mono text-[11px] font-bold uppercase tracking-widest text-black/45 hover:text-blue"
                      onClick={() => run(() => toggleListing(l.id, !l.isActive))}>
                      {l.isActive ? <><EyeOff className="size-3.5" /> Hide</> : <><Eye className="size-3.5" /> Show</>}
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {error && <p className="rounded-xl border border-red/30 bg-red/5 px-3.5 py-2.5 text-sm text-red">{error}</p>}
    </div>
  );
}
