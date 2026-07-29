'use client';

import { useState, useTransition } from 'react';
import { Download, CheckCircle2, Bike, Lock, Printer, PackageCheck, HandCoins, Ban } from 'lucide-react';
import { Button, ButtonLink } from '@/components/ui/Button';
import type { OrderStatus, FulfillmentMethod } from '@/lib/status';
import { canDecline } from '@/lib/status';
import {
  startPrinting, markPrintingDone, markReadyForDispatch,
  dispatchRider, confirmHandover, cantFulfil,
} from './actions';

/**
 * V2 queue controls. V1 had three buttons across three statuses; V2 walks the 7-stage
 * lifecycle (decision 18), so exactly one action is live at a time and the rest are locked.
 *
 * Collection orders (customer sending their own rider) skip the dispatch step entirely and
 * go straight from Ready to handover — PrintRuns isn't delivering those.
 */
export function QueueActions({
  orderId, status, method, fileUrl, collectorName, collectorPhone,
}: {
  orderId: string;
  status: OrderStatus;
  method: FulfillmentMethod;
  fileUrl: string | null;
  collectorName: string | null;
  collectorPhone: string | null;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState('');

  const isCollection = method === 'collection';

  function run(action: (id: string) => Promise<{ error?: string } | undefined>) {
    setError(null);
    start(async () => {
      const res = await action(orderId);
      if (res?.error) setError(res.error);
    });
  }

  const notStarted = status === 'order_received' || status === 'printer_assigned';
  const printing = status === 'printing_in_progress';
  const printed = status === 'printing_completed';
  const ready = status === 'ready_for_dispatch';
  const outForDelivery = status === 'out_for_delivery';

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

        {notStarted && (
          <Button size="sm" onClick={() => run(startPrinting)} disabled={pending}>
            <Printer className="size-4" /> Start printing
          </Button>
        )}

        {printing && (
          <Button size="sm" onClick={() => run(markPrintingDone)} disabled={pending}>
            <CheckCircle2 className="size-4" /> Mark printing done
          </Button>
        )}

        {printed && (
          <Button size="sm" onClick={() => run(markReadyForDispatch)} disabled={pending}>
            <PackageCheck className="size-4" />
            {isCollection ? 'Mark ready for collection' : 'Mark ready for dispatch'}
          </Button>
        )}

        {ready && !isCollection && (
          <Button size="sm" variant="secondary" onClick={() => run(dispatchRider)} disabled={pending}>
            <Bike className="size-4" /> Dispatch rider
          </Button>
        )}

        {(outForDelivery || (ready && isCollection)) && (
          <Button size="sm" variant="secondary" onClick={() => run(confirmHandover)} disabled={pending}>
            <HandCoins className="size-4" />
            {isCollection ? 'Confirm handover to collector' : 'Confirm delivered'}
          </Button>
        )}

        {!notStarted && !printing && !printed && !ready && !outForDelivery && (
          <Button variant="tertiary" size="sm" disabled>
            <Lock className="size-4" /> No action available
          </Button>
        )}

        {canDecline(status) && !declining && (
          <Button variant="tertiary" size="sm" onClick={() => setDeclining(true)} disabled={pending}>
            <Ban className="size-4" /> Can&apos;t fulfil
          </Button>
        )}
      </div>

      {/* Collection orders: the printer must only release to a collector PrintRuns confirmed. */}
      {isCollection && (ready || outForDelivery) && (
        <div className="mt-3 rounded-xl border border-blue/30 bg-blue/5 px-3.5 py-2.5 text-xs text-navy">
          <span className="font-bold">Customer is collecting.</span>{' '}
          {collectorName
            ? <>Release only to <span className="font-bold">{collectorName}</span>{collectorPhone ? ` (${collectorPhone})` : ''}.</>
            : <>PrintRuns will confirm who is authorised to collect — do not release before then.</>}
        </div>
      )}

      {declining && (
        <div className="mt-3 rounded-xl border border-red/30 bg-red/5 p-3.5">
          <p className="text-sm font-bold text-navy">Why can&apos;t you fulfil this job?</p>
          <p className="mt-1 text-xs text-black/60">
            The customer has already paid. PrintRuns will reassign the job or refund them, and
            this decline is recorded against your shop.
          </p>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. machine down, material out of stock"
            className="mt-2.5 w-full rounded-lg border border-black/20 px-3 py-2 text-sm"
          />
          <div className="mt-2.5 flex gap-2">
            <Button
              size="sm"
              onClick={() => { setDeclining(false); run((id) => cantFulfil(id, reason)); }}
              disabled={pending || reason.trim().length < 3}
            >
              Confirm — I can&apos;t fulfil
            </Button>
            <Button variant="tertiary" size="sm" onClick={() => setDeclining(false)} disabled={pending}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {error && <p className="mt-2 text-sm text-red">{error}</p>}
    </div>
  );
}
