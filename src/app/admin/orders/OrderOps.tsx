'use client';

import { useState, useTransition } from 'react';
import { naira } from '@/lib/format';
import { Button } from '@/components/ui/Button';
import { Field, Input, Textarea } from '@/components/ui/Field';
import {
  recordDeliveryResponse, setAuthorizedCollector, switchToCollection, cancelAndRefund, saveOpsNote,
} from './actions';

export type OpsOrder = {
  id: string;
  code: string;
  status: string;
  paymentStatus: string;
  fulfillmentMethod: string;
  deliveryFeeStatus: string;
  deliveryFeeKobo: number | null;
  amountPaidKobo: number | null;
  printerBaseKobo: number | null;
  deliveryAddress: string | null;
  contactPhonePrimary: string | null;
  contactPhoneSecondary: string | null;
  collectionAuthorizedName: string | null;
  collectionAuthorizedPhone: string | null;
  opsNote: string | null;
  shopName: string;
};

export function OrderOps({ order }: { order: OpsOrder }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [open, setOpen] = useState<'none' | 'collector' | 'cancel'>('none');
  const [name, setName] = useState(order.collectionAuthorizedName ?? '');
  const [phone, setPhone] = useState(order.collectionAuthorizedPhone ?? '');
  const [reason, setReason] = useState('');
  const [deduct, setDeduct] = useState('');
  const [note, setNote] = useState(order.opsNote ?? '');

  function run(fn: () => Promise<{ error?: string; warning?: string } | void>) {
    setError(null);
    setWarning(null);
    start(async () => {
      const res = await fn();
      if (res && 'error' in res && res.error) { setError(res.error); return; }
      // A refund Paystack refused still cancelled the order — ops must be told, loudly,
      // that the money has not moved and needs doing by hand.
      if (res && 'warning' in res && res.warning) setWarning(res.warning);
      setOpen('none');
    });
  }

  const awaitingCall = order.fulfillmentMethod === 'delivery' && order.deliveryFeeStatus === 'quoted';
  const shipped = order.status === 'out_for_delivery' || order.status === 'delivered' || order.status === 'cancelled';

  return (
    <div className="mt-3 border-t border-dashed border-black/20 pt-3">
      {awaitingCall && (
        <div className="rounded-xl border border-blue/30 bg-blue/5 p-3.5">
          <p className="font-display text-[13px] font-bold text-navy">
            Call the customer — {order.shopName} quoted {naira(order.deliveryFeeKobo)} for delivery
          </p>
          <p className="mt-0.5 text-xs text-black/60">
            {order.contactPhonePrimary}
            {order.contactPhoneSecondary ? ` · ${order.contactPhoneSecondary}` : ''}
          </p>
          <p className="mt-1 text-xs text-black/60">
            They pay this in cash to the rider on arrival. Nothing is charged online.
          </p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            <Button size="sm" disabled={pending} onClick={() => run(() => recordDeliveryResponse(order.id, 'accepted'))}>
              They accepted
            </Button>
            <Button size="sm" variant="tertiary" disabled={pending}
              onClick={() => run(() => recordDeliveryResponse(order.id, 'declined'))}>
              They declined → Collection
            </Button>
          </div>
        </div>
      )}

      {order.fulfillmentMethod === 'collection' && !shipped && (
        <div className="rounded-xl border border-black/12 p-3.5">
          <p className="font-display text-[13px] font-bold text-navy">Authorised collector</p>
          <p className="mt-0.5 text-xs text-black/55">
            {order.collectionAuthorizedName
              ? `${order.collectionAuthorizedName} · ${order.collectionAuthorizedPhone}`
              : 'Not set — the printer must not release the job until this is filled in.'}
          </p>
          {open === 'collector' ? (
            <div className="mt-2.5 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
              <Field label="Name"><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
              <Field label="Phone"><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
              <Button size="sm" className="self-end" disabled={pending}
                onClick={() => run(() => setAuthorizedCollector(order.id, name, phone))}>
                Save
              </Button>
            </div>
          ) : (
            <Button size="sm" variant="tertiary" className="mt-2" onClick={() => setOpen('collector')}>
              {order.collectionAuthorizedName ? 'Change collector' : 'Set collector'}
            </Button>
          )}
        </div>
      )}

      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        {order.fulfillmentMethod === 'delivery' && !shipped && (
          <Button size="sm" variant="tertiary" disabled={pending}
            onClick={() => run(() => switchToCollection(order.id))}>
            Switch to Collection
          </Button>
        )}
        {order.status !== 'cancelled' && (
          <Button size="sm" variant="tertiary" onClick={() => setOpen(open === 'cancel' ? 'none' : 'cancel')}>
            Cancel / refund
          </Button>
        )}
      </div>

      {open === 'cancel' && (
        <div className="mt-2.5 rounded-xl border border-red/30 bg-red/5 p-3.5">
          <p className="text-xs text-black/60">
            This cancels the order, submits the refund to Paystack, and withholds settlement —
            {order.amountPaidKobo ? ` the customer paid ${naira(order.amountPaidKobo)}.` : ' nothing was paid on this order.'}
          </p>
          <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
            <Field label="Reason" hint="Stored on the order as the audit trail.">
              <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Customer unreachable after 3 attempts" />
            </Field>
            <Field label="Production cost to deduct (₦)" hint="Leave blank for a full refund.">
              <Input inputMode="numeric" value={deduct}
                onChange={(e) => setDeduct(e.target.value.replace(/\D/g, ''))}
                placeholder={order.printerBaseKobo ? String(order.printerBaseKobo / 100) : '0'} />
            </Field>
          </div>
          <div className="mt-2.5 flex flex-wrap gap-2">
            <Button size="sm" disabled={pending}
              onClick={() => run(() => cancelAndRefund(order.id, deduct ? 'less_production' : 'full', reason, deduct))}>
              {deduct ? `Cancel, refund less ₦${deduct}` : 'Cancel and refund in full'}
            </Button>
            <Button size="sm" variant="tertiary" onClick={() => setOpen('none')}>Back</Button>
          </div>
        </div>
      )}

      <div className="mt-2.5">
        <Field label="Ops note" hint="Who you called, what they said.">
          <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)}
            onBlur={() => { if (note !== (order.opsNote ?? '')) run(() => saveOpsNote(order.id, note)); }} />
        </Field>
      </div>

      {error && <p className="mt-2 rounded-xl border border-red/30 bg-red/5 px-3.5 py-2 text-sm text-red">{error}</p>}
      {warning && (
        <p className="mt-2 rounded-xl border border-red/40 bg-red/10 px-3.5 py-2 text-sm font-semibold text-red">
          {warning}
        </p>
      )}
    </div>
  );
}
