'use client';

import { useState } from 'react';
import { Check, Minus } from 'lucide-react';
import { naira } from '@/lib/format';
import { Button } from '@/components/ui/Button';
import type { TierKey } from '@/lib/subscriptions';

export type PlanRow = {
  key: TierKey;
  name: string;
  priceKobo: number;
  capLabel: string;
  retentionLabel: string;
  priority: string;
  materialAdvance: boolean;
  dedicatedSupport: boolean;
};

export function PlanClient({
  plans, current, endsAt, included,
}: {
  plans: PlanRow[];
  current: TierKey;
  endsAt: string | null;
  included: string[];
}) {
  const [busy, setBusy] = useState<TierKey | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function upgrade(tier: TierKey) {
    setBusy(tier);
    setError(null);
    try {
      const res = await fetch('/api/subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? 'Could not start payment.'); return; }
      window.location.href = json.authorizationUrl;
    } catch {
      setError('Could not reach the payment page.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <ul className="mt-6 grid gap-4 lg:grid-cols-3">
        {plans.map((p) => {
          const isCurrent = p.key === current;
          return (
            <li key={p.key}
              className={`flex flex-col rounded-2xl border bg-white p-5 ${isCurrent ? 'border-blue' : 'border-black/12'}`}>
              <div className="flex items-baseline justify-between gap-2">
                <h2 className="font-display text-xl font-extrabold tracking-tight text-navy">{p.name}</h2>
                {isCurrent && (
                  <span className="rounded-pill bg-blue px-2.5 py-1 font-mono text-[9px] font-bold uppercase tracking-widest text-white">
                    Current
                  </span>
                )}
              </div>

              <p className="mt-1.5 font-display text-2xl font-extrabold text-navy">
                {p.priceKobo === 0 ? 'Free' : naira(p.priceKobo)}
                {p.priceKobo > 0 && <span className="ml-1 font-mono text-[12px] font-bold text-black/45">/ 2 months</span>}
              </p>

              <dl className="mt-4 space-y-2 border-t border-dashed border-black/20 pt-3 text-[13px]">
                <div className="flex justify-between gap-2">
                  <dt className="text-black/55">Max order value</dt>
                  <dd className="font-display font-extrabold text-navy">{p.capLabel}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-black/55">Files kept after a job</dt>
                  <dd className="font-display font-extrabold text-navy">{p.retentionLabel}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-black/55">Search priority</dt>
                  <dd className="font-display font-extrabold text-navy">{p.priority}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-black/55">50% material advance</dt>
                  <dd>{p.materialAdvance
                    ? <Check className="size-4 text-success" />
                    : <Minus className="size-4 text-black/25" />}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-black/55">Dedicated support</dt>
                  <dd>{p.dedicatedSupport
                    ? <Check className="size-4 text-success" />
                    : <Minus className="size-4 text-black/25" />}</dd>
                </div>
              </dl>

              <div className="mt-auto pt-4">
                {isCurrent ? (
                  <p className="text-center font-mono text-[11px] uppercase tracking-widest text-black/45">
                    {endsAt ? `Renews ${endsAt}` : 'Your plan'}
                  </p>
                ) : p.priceKobo === 0 ? (
                  <p className="text-center font-mono text-[11px] uppercase tracking-widest text-black/35">
                    Where everyone starts
                  </p>
                ) : (
                  <Button className="w-full" disabled={busy !== null} onClick={() => upgrade(p.key)}>
                    {busy === p.key ? 'Opening payment…' : `Upgrade to ${p.name}`}
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {error && <p className="mt-4 rounded-xl border border-red/30 bg-red/5 px-3.5 py-2.5 text-sm text-red">{error}</p>}

      <div className="mt-6 rounded-2xl border border-black/12 bg-white p-5">
        <p className="font-display text-[15px] font-extrabold text-navy">On every plan</p>
        <ul className="mt-2 grid gap-1.5 sm:grid-cols-3">
          {included.map((f) => (
            <li key={f} className="flex items-center gap-2 text-[14px] text-black/70">
              <Check className="size-4 shrink-0 text-success" /> {f}
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
