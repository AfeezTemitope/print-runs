'use client';

import { useState, useTransition } from 'react';
import { naira } from '@/lib/format';
import { Button } from '@/components/ui/Button';
import { Field, Input, Textarea } from '@/components/ui/Field';
import { settleDesigner, cancelDesignOrder, saveDesignOpsNote } from './actions';

export type DesignOpsOrder = {
  id: string;
  status: string;
  settlementStatus: string;
  amountPaidKobo: number;
  designerBaseKobo: number;
  contactEmail: string;
  contactPhone: string;
  opsNote: string | null;
  studioName: string;
  stalledDays: number | null;
};

export function DesignOps({ order }: { order: DesignOpsOrder }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [refund, setRefund] = useState('');
  const [note, setNote] = useState(order.opsNote ?? '');

  function run(fn: () => Promise<{ error?: string; warning?: string } | void>) {
    setError(null);
    setWarning(null);
    start(async () => {
      const res = await fn();
      if (res && 'error' in res && res.error) { setError(res.error); return; }
      if (res && 'warning' in res && res.warning) setWarning(res.warning);
      setOpen(false);
    });
  }

  return (
    <div className="mt-3 border-t border-dashed border-black/20 pt-3">
      {/* Unanswered proofs never auto-approve, so ops has to chase — this is the prompt. */}
      {order.stalledDays !== null && order.stalledDays >= 3 && (
        <div className="mb-2.5 rounded-xl border border-blue/30 bg-blue/5 p-3">
          <p className="font-display text-[13px] font-bold text-navy">
            Waiting on the customer for {order.stalledDays} days — chase them
          </p>
          <p className="mt-0.5 text-xs text-black/60">{order.contactEmail} · {order.contactPhone}</p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {order.status === 'approved' && order.settlementStatus === 'pending' && (
          <Button size="sm" disabled={pending} onClick={() => run(() => settleDesigner(order.id))}>
            Mark {order.studioName} paid — {naira(order.designerBaseKobo)}
          </Button>
        )}
        {order.status === 'approved' && order.settlementStatus === 'settled' && (
          <p className="text-[13px] font-semibold text-success">Designer paid.</p>
        )}
        {order.status !== 'cancelled' && (
          <Button size="sm" variant="tertiary" onClick={() => setOpen((o) => !o)}>Cancel / refund</Button>
        )}
      </div>

      {open && (
        <div className="mt-2.5 rounded-xl border border-red/30 bg-red/5 p-3.5">
          <p className="text-xs text-black/60">
            Submits the refund to Paystack and withholds settlement. The customer paid {naira(order.amountPaidKobo)}.
          </p>
          <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
            <Field label="Reason">
              <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Designer unresponsive" />
            </Field>
            <Field label="Refund amount (₦)" hint="Blank refunds everything.">
              <Input inputMode="numeric" value={refund}
                onChange={(e) => setRefund(e.target.value.replace(/\D/g, ''))}
                placeholder={String(order.amountPaidKobo / 100)} />
            </Field>
          </div>
          <div className="mt-2.5 flex flex-wrap gap-2">
            <Button size="sm" disabled={pending}
              onClick={() => run(() => cancelDesignOrder(order.id, reason, refund || undefined))}>
              {refund ? `Cancel, refund ₦${refund}` : 'Cancel and refund in full'}
            </Button>
            <Button size="sm" variant="tertiary" onClick={() => setOpen(false)}>Back</Button>
          </div>
        </div>
      )}

      <div className="mt-2.5">
        <Field label="Ops note">
          <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)}
            onBlur={() => { if (note !== (order.opsNote ?? '')) run(() => saveDesignOpsNote(order.id, note)); }} />
        </Field>
      </div>

      {error && <p className="mt-2 rounded-xl border border-red/30 bg-red/5 px-3.5 py-2 text-sm text-red">{error}</p>}
      {warning && <p className="mt-2 rounded-xl border border-red/40 bg-red/10 px-3.5 py-2 text-sm font-semibold text-red">{warning}</p>}
    </div>
  );
}
