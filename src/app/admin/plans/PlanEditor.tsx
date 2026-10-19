'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import { saveTierSetting } from './actions';

export type EditableTier = {
  key: string;
  name: string;
  price: string;      // naira
  cap: string;        // naira, or 'unlimited'
  retention: string;  // days
  shops: number;
};

function Row({ tier }: { tier: EditableTier }) {
  const [price, setPrice] = useState(tier.price);
  const [cap, setCap] = useState(tier.cap);
  const [retention, setRetention] = useState(tier.retention);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function save(field: 'price_kobo' | 'cap_kobo' | 'retention_days', value: string) {
    setError(null);
    start(async () => {
      const res = await saveTierSetting(tier.key, field, value);
      if (res?.error) setError(res.error); else setSaved(true);
    });
  }

  return (
    <li className="rounded-2xl border border-black/12 bg-white p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-display text-[15px] font-extrabold text-navy">{tier.name}</p>
        <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-black/45">
          {tier.shops} printer{tier.shops === 1 ? '' : 's'}
        </p>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <Field label="Price (₦ / 2 months)">
          <Input inputMode="numeric" value={price}
            onChange={(e) => { setPrice(e.target.value.replace(/[^\d]/g, '')); setSaved(false); }}
            onBlur={() => save('price_kobo', price)} />
        </Field>
        <Field label="Order cap (₦)" hint="Blank or 'unlimited' for no cap.">
          <Input value={cap}
            onChange={(e) => { setCap(e.target.value); setSaved(false); }}
            onBlur={() => save('cap_kobo', cap)} />
        </Field>
        <Field label="File retention (days)">
          <Input inputMode="numeric" value={retention}
            onChange={(e) => { setRetention(e.target.value.replace(/[^\d]/g, '')); setSaved(false); }}
            onBlur={() => save('retention_days', retention)} />
        </Field>
      </div>

      <p className="mt-1 font-mono text-[11px] uppercase tracking-widest text-black/40">
        {pending ? 'Saving…' : saved ? 'Saved' : 'Changes save when you leave a field'}
      </p>
      {error && <p className="mt-1 text-sm text-red">{error}</p>}
    </li>
  );
}

export function PlanEditor({ tiers }: { tiers: EditableTier[] }) {
  return <ul className="mt-6 space-y-3">{tiers.map((t) => <Row key={t.key} tier={t} />)}</ul>;
}
