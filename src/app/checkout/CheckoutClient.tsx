'use client';

import Link from 'next/link';

import { useState } from 'react';
import { Bike } from 'lucide-react';
import { naira } from '@/lib/format';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import { CodeBadge } from '@/components/ui/CodeBadge';

type Props = {
  shop: { id: string; name: string; code: string };
  categoryName: string;
  isQuote: boolean;
  lines: { label: string; amountKobo: number }[];
  sellingPriceKobo: number | null;
  platformFeeKobo: number | null;
  totalKobo: number | null;
  query: Record<string, string>;
};

/**
 * V2: no fulfillment choice here — every order is delivery, and the delivery fee itself is
 * quoted by a PrintRuns rep after payment (decision 13/B1), so it never appears on this screen.
 * Contact fields (email + both phone numbers) and the design-confirmation checkbox are new
 * required fields (decision 21 / Batch 1 foundation).
 */
export function CheckoutClient({ shop, categoryName, isQuote, lines, sellingPriceKobo, platformFeeKobo, totalKobo, query }: Props) {
  const [address, setAddress] = useState('');
  const [email, setEmail] = useState('');
  const [phonePrimary, setPhonePrimary] = useState('');
  const [phoneSecondary, setPhoneSecondary] = useState('');
  const [designConfirmed, setDesignConfirmed] = useState(false);
  const [legalAccepted, setLegalAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ready =
    address.trim().length > 5 &&
    email.trim().includes('@') &&
    phonePrimary.trim().length >= 7 &&
    phoneSecondary.trim().length >= 7 &&
    designConfirmed &&
    legalAccepted;

  async function pay() {
    setBusy(true);
    setError(null);
    const res = await fetch('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...query,
        shop: shop.id,
        deliveryAddress: address,
        contactEmail: email,
        contactPhonePrimary: phonePrimary,
        contactPhoneSecondary: phoneSecondary,
        designConfirmed: designConfirmed ? 'true' : 'false',
        legalAccepted: legalAccepted ? 'true' : 'false',
      }),
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
        <h2 className="font-display text-sm font-extrabold uppercase tracking-wide text-navy">Delivery details</h2>
        <div className="mt-3 flex items-start gap-3 rounded-2xl border border-blue bg-blue px-4 py-3.5 text-white">
          <Bike className="mt-0.5 size-5 shrink-0" />
          <span>
            <span className="block font-display text-[15px] font-extrabold">Delivery</span>
            <span className="text-xs text-white/80">
              A PrintRuns rep will contact you after payment to confirm the delivery fee.
            </span>
          </span>
        </div>

        <div className="mt-4 space-y-3.5">
          <Field label="Delivery address">
            <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="e.g. 24 Admiralty Way, Lekki Phase 1" autoComplete="street-address" />
          </Field>
          <Field label="Email">
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" />
          </Field>
          <div className="grid gap-3.5 sm:grid-cols-2">
            <Field label="Primary phone">
              <Input type="tel" value={phonePrimary} onChange={(e) => setPhonePrimary(e.target.value)} placeholder="0803 000 0000" autoComplete="tel" />
            </Field>
            <Field label="Secondary phone" hint="Required — helps us reach you about delivery.">
              <Input type="tel" value={phoneSecondary} onChange={(e) => setPhoneSecondary(e.target.value)} placeholder="0803 000 0000" autoComplete="tel" />
            </Field>
          </div>
        </div>
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
            {sellingPriceKobo != null && (
              <div className="flex justify-between border-b border-dashed border-black/20 py-2.5">
                <dt className="text-black/55">Product price</dt>
                <dd className="font-bold text-navy">{naira(sellingPriceKobo)}</dd>
              </div>
            )}
            {platformFeeKobo != null && (
              <div className="flex justify-between border-b border-dashed border-black/20 py-2.5">
                <dt className="text-black/55">Platform service fee</dt>
                <dd className="font-bold text-navy">{naira(platformFeeKobo)}</dd>
              </div>
            )}
            <div className="flex justify-between pt-3">
              <dt className="font-display font-extrabold text-navy">Total (delivery quoted separately)</dt>
              <dd className="font-display text-xl font-extrabold text-navy">{naira(totalKobo)}</dd>
            </div>
          </dl>
        )}
      </section>

      <section className="mt-5 rounded-2xl border border-black/12 bg-white p-5 sm:p-6">
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={designConfirmed}
            onChange={(e) => setDesignConfirmed(e.target.checked)}
            className="mt-0.5 size-4 accent-blue"
          />
          <span className="text-sm leading-relaxed text-black/70">
            I confirm the artwork I&apos;ve provided is final and ready to print. I understand PrintRuns and
            the printer are not responsible for errors that were visible in what I approved.
          </span>
        </label>

        {/* Separate from the artwork confirmation on purpose: bundling "my file is correct"
            with "I accept your terms" makes a single tick do two very different jobs. */}
        <label className="mt-3.5 flex items-start gap-3 border-t border-dashed border-black/20 pt-3.5">
          <input
            type="checkbox"
            checked={legalAccepted}
            onChange={(e) => setLegalAccepted(e.target.checked)}
            className="mt-0.5 size-4 accent-blue"
          />
          <span className="text-sm leading-relaxed text-black/70">
            I accept the{' '}
            <Link href="/legal/terms" target="_blank" className="font-semibold text-blue underline">Terms &amp; Conditions</Link>,{' '}
            <Link href="/legal/privacy" target="_blank" className="font-semibold text-blue underline">Privacy Policy</Link>,{' '}
            <Link href="/legal/refunds" target="_blank" className="font-semibold text-blue underline">Refund &amp; Cancellation Policy</Link>{' '}
            and{' '}
            <Link href="/legal/acceptable-use" target="_blank" className="font-semibold text-blue underline">Acceptable Use Policy</Link>.
          </span>
        </label>
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
