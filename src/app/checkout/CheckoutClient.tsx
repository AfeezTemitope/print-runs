'use client';

import { useState } from 'react';
import { Bike, Store } from 'lucide-react';
import { naira } from '@/lib/format';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import { CodeBadge } from '@/components/ui/CodeBadge';

type Props = {
  shop: { id: string; name: string; code: string; supportsPickup: boolean; supportsDelivery: boolean };
  categoryName: string;
  isQuote: boolean;
  lines: { label: string; amountKobo: number }[];
  totalKobo: number | null;
  query: Record<string, string>;
};

export function CheckoutClient({ shop, categoryName, isQuote, lines, totalKobo, query }: Props) {
  const [method, setMethod] = useState<'delivery' | 'pickup'>(shop.supportsDelivery ? 'delivery' : 'pickup');
  const [address, setAddress] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const needsAddress = method === 'delivery';
  const ready = !needsAddress || address.trim().length > 5;

  async function pay() {
    setBusy(true);
    setError(null);
    const res = await fetch('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...query, shop: shop.id, fulfillmentMethod: method, deliveryAddress: address }),
    });
    const json = await res.json();
    if (!res.ok) { setBusy(false); setError(json.error ?? 'Could not start checkout.'); return; }
    if (json.quote) { window.location.href = '/orders?quote=1'; return; }
    window.location.href = json.authorizationUrl; // → Paystack
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <p className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-blue">Step 3 of 3</p>
      <h1 className="mt-1 font-display text-4xl font-extrabold tracking-tight text-black">
        {isQuote ? <>Request a <span className="text-blue">quote</span></> : <>Pay & <span className="text-blue">print</span></>}
      </h1>
      <p className="mt-2 flex items-center gap-2 text-sm text-black/55">
        {categoryName} · {shop.name} <CodeBadge code={shop.code} tone="light" />
      </p>

      <section className="mt-7 rounded-2xl border border-black/12 bg-white p-5 sm:p-6">
        <h2 className="font-display text-sm font-extrabold uppercase tracking-wide text-navy">How do you want it?</h2>
        <div className="mt-3 grid gap-2.5 sm:grid-cols-2" role="radiogroup" aria-label="Fulfillment">
          <button
            role="radio"
            aria-checked={method === 'delivery'}
            disabled={!shop.supportsDelivery}
            onClick={() => setMethod('delivery')}
            className={`flex items-start gap-3 rounded-2xl border p-4 text-left transition-colors disabled:opacity-40 ${
              method === 'delivery' ? 'border-blue bg-blue text-white' : 'border-black/15 text-navy hover:border-black/35'
            }`}
          >
            <Bike className="mt-0.5 size-5 shrink-0" />
            <span>
              <span className="block font-display text-[15px] font-extrabold">Delivery</span>
              <span className={`text-xs ${method === 'delivery' ? 'text-white/80' : 'text-black/50'}`}>Rider brings it — Island & Mainland</span>
            </span>
          </button>
          {/* Pickup renders only when this printer supports it (spec §3 screen 5). */}
          {shop.supportsPickup && (
            <button
              role="radio"
              aria-checked={method === 'pickup'}
              onClick={() => setMethod('pickup')}
              className={`flex items-start gap-3 rounded-2xl border p-4 text-left transition-colors ${
                method === 'pickup' ? 'border-blue bg-blue text-white' : 'border-black/15 text-navy hover:border-black/35'
              }`}
            >
              <Store className="mt-0.5 size-5 shrink-0" />
              <span>
                <span className="block font-display text-[15px] font-extrabold">Self-pickup</span>
                <span className={`text-xs ${method === 'pickup' ? 'text-white/80' : 'text-black/50'}`}>Collect it from the shop yourself</span>
              </span>
            </button>
          )}
        </div>

        {needsAddress && (
          <div className="mt-4">
            <Field label="Delivery address">
              <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="e.g. 24 Admiralty Way, Lekki Phase 1" autoComplete="street-address" />
            </Field>
          </div>
        )}
      </section>

      <section className="mt-5 rounded-2xl border border-black/12 bg-white p-5 sm:p-6">
        <h2 className="font-display text-sm font-extrabold uppercase tracking-wide text-navy">
          {isQuote ? 'What happens next' : 'Price breakdown'}
        </h2>
        {isQuote ? (
          <p className="mt-3 text-sm leading-relaxed text-black/60">
            {shop.name} hasn&apos;t set a fixed price for this exact spec. Send the request and it lands with
            them directly — you&apos;ll see it in your orders, and you only pay once a price is agreed.
          </p>
        ) : (
          <dl className="mt-3 font-mono text-sm">
            {lines.map((l, i) => (
              <div key={i} className="flex justify-between border-b border-dashed border-black/20 py-2.5">
                <dt className="text-black/55">{l.label}</dt>
                <dd className="font-bold text-navy">{naira(l.amountKobo)}</dd>
              </div>
            ))}
            <div className="flex justify-between pt-3">
              <dt className="font-display font-extrabold text-navy">Total</dt>
              <dd className="font-display text-xl font-extrabold text-navy">{naira(totalKobo)}</dd>
            </div>
          </dl>
        )}
      </section>

      {error && <p className="mt-4 rounded-xl border border-red/30 bg-red/5 px-3.5 py-2.5 text-sm text-red">{error}</p>}

      <Button onClick={pay} disabled={!ready || busy} className="mt-6 w-full">
        {busy ? 'One moment…' : isQuote ? 'Send quote request' : `Pay ${naira(totalKobo)} with Paystack`} <span aria-hidden>→</span>
      </Button>
      <p className="mt-2.5 text-center font-mono text-[10px] uppercase tracking-widest text-black/40">
        {isQuote ? 'No payment yet' : 'Secured by Paystack · NGN'}
      </p>
    </div>
  );
}
