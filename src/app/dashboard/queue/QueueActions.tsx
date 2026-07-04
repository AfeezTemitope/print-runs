'use client';

import { useState, useTransition } from 'react';
import { Download, CheckCircle2, Bike, BellRing, Lock } from 'lucide-react';
import { Button, ButtonLink } from '@/components/ui/Button';
import { markPrintingDone, completeJob } from './actions';

/**
 * The three-button logic, exactly as specced (§4.1):
 *  1 Download file — always available once the job is in the queue
 *  2 Mark printing done — flips status, turns solid green once pressed
 *  3 Dispatch Rider / Notify for Pickup — same slot, adapts to the order's
 *    fulfillment_method, LOCKED until Button 2 has been pressed
 */
export function QueueActions({
  orderId, status, method, fileUrl,
}: { orderId: string; status: string; method: 'delivery' | 'pickup'; fileUrl: string | null }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const done = status === 'ready';

  function run(action: (id: string) => Promise<{ error?: string } | undefined>) {
    setError(null);
    start(async () => {
      const res = await action(orderId);
      if (res?.error) setError(res.error);
    });
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2.5">
        {fileUrl ? (
          <ButtonLink href={fileUrl} target="_blank" variant="tertiary" size="sm">
            <Download className="size-4" /> Download file
          </ButtonLink>
        ) : (
          <Button variant="tertiary" size="sm" disabled title="Customer didn't attach a file">
            <Download className="size-4" /> No file attached
          </Button>
        )}

        <Button
          size="sm"
          onClick={() => run(markPrintingDone)}
          disabled={done || pending}
          className={done ? '!border-success !bg-success !text-white !opacity-100' : ''}
        >
          <CheckCircle2 className="size-4" /> {done ? 'Printing done ✓' : 'Mark printing done'}
        </Button>

        <Button
          size="sm"
          variant="secondary"
          onClick={() => run(completeJob)}
          disabled={!done || pending}
          title={done ? undefined : 'Finish printing first'}
        >
          {done ? (
            method === 'delivery' ? <Bike className="size-4" /> : <BellRing className="size-4" />
          ) : (
            <Lock className="size-4" />
          )}
          {method === 'delivery' ? 'Dispatch rider' : 'Notify customer for pickup'}
        </Button>
      </div>
      {error && <p className="mt-2 text-sm text-red">{error}</p>}
    </div>
  );
}
