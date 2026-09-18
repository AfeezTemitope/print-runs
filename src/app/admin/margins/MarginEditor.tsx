'use client';

import { useState, useTransition } from 'react';
import { naira } from '@/lib/format';
import { computeMargin } from '@/lib/pricing';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Field';
import { saveCategoryMargin } from './actions';

export type MarginRow = {
  categorySlug: string;
  name: string;
  marginType: 'fixed' | 'percent';
  value: string;        // naira for fixed, percent for percent
  configured: boolean;  // false = still falling back to the product's own stored margin
  sampleBaseKobo: number;
  sampleQty: number;
};

function Row({ row }: { row: MarginRow }) {
  const [type, setType] = useState<'fixed' | 'percent'>(row.marginType);
  const [value, setValue] = useState(row.value);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // The live preview that made a percentage margin acceptable at all (decision 23): the
  // customer-facing price is shown next to the field BEFORE saving, so it can never move
  // silently. Same arithmetic as the server — computeMargin is the single source.
  const n = Number(value || 0);
  const margin = computeMargin(row.sampleBaseKobo, row.sampleQty, {
    marginType: type,
    marginFixedKobo: type === 'fixed' ? Math.round(n * 100) : 0,
    marginPercentBps: type === 'percent' ? Math.round(n * 100) : 0,
  });

  return (
    <li className="rounded-2xl border border-black/12 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-display text-[15px] font-extrabold text-navy">{row.name}</p>
          <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-black/45">
            {row.configured ? 'configured' : 'using the default'}
          </p>
        </div>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-[130px_1fr_auto]">
        <Select value={type} onChange={(e) => { setType(e.target.value as 'fixed' | 'percent'); setSaved(false); }} aria-label="Margin type">
          <option value="fixed">₦ per piece</option>
          <option value="percent">% of base</option>
        </Select>
        <Input
          inputMode="decimal"
          value={value}
          onChange={(e) => { setValue(e.target.value.replace(/[^\d.]/g, '')); setSaved(false); }}
          aria-label={`${row.name} margin`}
          placeholder="0"
        />
        <Button size="sm" disabled={pending} onClick={() => {
          setError(null);
          start(async () => {
            const res = await saveCategoryMargin(row.categorySlug, type, value);
            if (res?.error) setError(res.error); else setSaved(true);
          });
        }}>
          {pending ? 'Saving…' : saved ? 'Saved' : 'Save'}
        </Button>
      </div>

      <div className="mt-2.5 rounded-xl bg-pale/40 px-3.5 py-2.5 font-mono text-[12px] text-navy">
        On a {naira(row.sampleBaseKobo)} job of {row.sampleQty}:
        {' '}printer keeps {naira(row.sampleBaseKobo)},
        {' '}you make <strong>{naira(margin)}</strong>,
        {' '}customer sees <strong>{naira(row.sampleBaseKobo + margin)}</strong>
        {' '}before the platform fee.
      </div>

      {error && <p className="mt-2 text-sm text-red">{error}</p>}
    </li>
  );
}

export function MarginEditor({ rows }: { rows: MarginRow[] }) {
  return <ul className="mt-6 grid gap-4 sm:grid-cols-2">{rows.map((r) => <Row key={r.categorySlug} row={r} />)}</ul>;
}
