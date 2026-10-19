'use client';

import { useState, useTransition } from 'react';
import { naira } from '@/lib/format';
import { Button } from '@/components/ui/Button';
import { askForAdvance } from '@/app/dashboard/payouts/actions';

/**
 * Pro plan: request half the job value up front for materials (brief, Pro tier). Only shown
 * once the printer has accepted the job — the server checks the same rule independently.
 */
export function AdvanceButton({
  orderId, amountKobo, already,
}: { orderId: string; amountKobo: number; already: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(already);

  if (done) {
    return (
      <p className="mt-2 font-mono text-[10px] font-bold uppercase tracking-widest text-blue">
        Advance requested — PrintRuns will release it shortly
      </p>
    );
  }

  return (
    <div className="mt-2">
      <Button size="sm" variant="tertiary" disabled={pending}
        onClick={() => start(async () => {
          const res = await askForAdvance(orderId);
          if (res && 'error' in res && res.error) setError(res.error); else setDone(true);
        })}>
        Request {naira(amountKobo)} advance for materials
      </Button>
      <p className="mt-1 text-xs text-black/50">
        Half now, the rest after delivery. It&apos;s deducted from your final payout.
      </p>
      {error && <p className="mt-1 text-xs text-red">{error}</p>}
    </div>
  );
}
