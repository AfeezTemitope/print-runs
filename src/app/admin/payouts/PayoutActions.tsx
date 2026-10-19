'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/Button';
import { releasePayout, retryPayout, settleNow } from './actions';

export function ReleaseButton({ id, state, auto }: { id: string; state: string; auto: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (state === 'paid' || state === 'processing') return null;

  return (
    <div className="flex flex-col items-end gap-1">
      {state === 'failed' ? (
        <Button size="sm" variant="tertiary" disabled={pending}
          onClick={() => start(async () => {
            const res = await retryPayout(id);
            if (res && 'error' in res && res.error) setError(res.error);
          })}>
          Retry
        </Button>
      ) : (
        <Button size="sm" disabled={pending}
          onClick={() => {
            // Manual mode records money PrintRuns has already sent. Confirming guards against a
            // misclick marking someone paid who was not.
            if (!auto && !window.confirm('Mark this as paid? Only do this once you have sent the money yourself.')) return;
            start(async () => {
              const res = await releasePayout(id);
              if (res && 'error' in res && res.error) setError(res.error);
            });
          }}>
          {auto ? 'Send now' : 'Mark as paid'}
        </Button>
      )}
      {error && <p className="text-xs text-red">{error}</p>}
    </div>
  );
}

export function SettleNowButton() {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-3">
      <Button size="sm" variant="tertiary" disabled={pending}
        onClick={() => start(async () => {
          const res = await settleNow();
          if (res && 'error' in res && res.error) setResult(res.error);
          else if (res && 'checked' in res) {
            setResult(`${res.created} new payout${res.created === 1 ? '' : 's'} from ${res.checked} eligible order${res.checked === 1 ? '' : 's'}`);
          }
        })}>
        {pending ? 'Running…' : 'Run settlement now'}
      </Button>
      {result && <span className="font-mono text-[11px] text-black/55">{result}</span>}
    </div>
  );
}
