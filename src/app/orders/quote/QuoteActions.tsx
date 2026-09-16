'use client';

import { useState, useTransition } from 'react';
import { naira } from '@/lib/format';
import { Button } from '@/components/ui/Button';
import { declineQuote } from './actions';

/**
 * The customer's side of a quote (§7.3). Accepting IS paying — there is no separate accept
 * step, because an acceptance that did not take payment would just be another thing to chase.
 */
export function QuoteActions({
  orderId, quotedPriceKobo, note, printer,
}: { orderId: string; quotedPriceKobo: number; note: string | null; printer: string }) {
  const [busy, setBusy] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function pay() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/order/pay-quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? 'Could not start payment.'); return; }
      window.location.href = json.authorizationUrl;
    } catch {
      setError('Could not reach the payment page.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 rounded-xl border border-blue bg-blue/5 p-4">
      <p className="font-display text-[15px] font-extrabold text-navy">
        {printer} quoted {naira(quotedPriceKobo)}
      </p>
      {note && <p className="mt-1 text-[14px] text-black/70">{note}</p>}
      <p className="mt-1 text-xs text-black/55">
        PrintRuns&apos; fee is added at payment. Nothing has been charged yet.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" disabled={busy} onClick={pay}>
          {busy ? 'Opening payment…' : 'Accept and pay'}
        </Button>
        <Button size="sm" variant="tertiary" disabled={pending}
          onClick={() => start(async () => {
            const res = await declineQuote(orderId);
            if (res?.error) setError(res.error);
          })}>
          Decline
        </Button>
      </div>
      {error && <p className="mt-2 text-sm text-red">{error}</p>}
    </div>
  );
}
