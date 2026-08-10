'use client';

import { useState } from 'react';
import Link from 'next/link';
import { naira } from '@/lib/format';
import { Button } from '@/components/ui/Button';
import { Field, Input, Textarea } from '@/components/ui/Field';
import { PhotoUpload } from '@/components/ui/PhotoUpload';

export type BookProps = {
  serviceId: string;
  studioName: string;
  serviceTitle: string;
  priceKobo: number;
  marginKobo: number;
  platformFeeKobo: number;
  totalKobo: number;
  revisionsIncluded: number;
  extraRevisionKobo: number;
  turnaroundHours: number;
  defaultEmail: string;
};

export function BookClient(p: BookProps) {
  const [brief, setBrief] = useState('');
  const [briefFile, setBriefFile] = useState<string | undefined>();
  const [email, setEmail] = useState(p.defaultEmail);
  const [phone, setPhone] = useState('');
  const [reviewMode, setReviewMode] = useState<'review' | 'direct'>('review');
  const [legalAccepted, setLegalAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ready = brief.trim().length >= 20 && email.includes('@') && phone.trim().length >= 7 && legalAccepted;

  async function pay() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/design/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service: p.serviceId,
          brief,
          briefFile: briefFile ?? '',
          contactEmail: email,
          contactPhone: phone,
          reviewMode,
          legalAccepted: legalAccepted ? 'true' : 'false',
        }),
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
    <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
      <div className="space-y-5 rounded-2xl border border-black/12 bg-white p-5 sm:p-7">
        <Field label="Your brief" hint="The more specific you are, the fewer revisions you'll need.">
          <Textarea rows={6} value={brief} onChange={(e) => setBrief(e.target.value)}
            placeholder="What the design is for, who it's aimed at, colours or styles you like, anything to avoid…" />
        </Field>

        <Field label="Reference image (optional)">
          <PhotoUpload kind="products" label="Reference" aspect="aspect-[3/2]" url={briefFile} onChange={setBriefFile} />
        </Field>

        <div>
          <span className="mb-2 block font-display text-[13px] font-bold text-navy">Before printing</span>
          <div className="space-y-2">
            {([
              ['review', 'Show me the design first', 'Nothing prints until you approve it. Recommended.'],
              ['direct', 'Send it straight to print', 'Faster, but you accept the design decisions made from your brief.'],
            ] as const).map(([value, title, hint]) => (
              <button key={value} onClick={() => setReviewMode(value)}
                className={`flex w-full flex-col gap-0.5 rounded-2xl border px-4 py-3 text-left transition-colors ${
                  reviewMode === value ? 'border-blue bg-blue text-white' : 'border-black/15 text-navy hover:border-black/35'
                }`}>
                <span className="font-display text-sm font-extrabold">{title}</span>
                <span className={`text-xs ${reviewMode === value ? 'text-white/75' : 'text-black/45'}`}>{hint}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Email"><Input value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          <Field label="Phone"><Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="080…" /></Field>
        </div>

        <label className="flex items-start gap-3 border-t border-dashed border-black/20 pt-3.5">
          <input type="checkbox" checked={legalAccepted} onChange={(e) => setLegalAccepted(e.target.checked)}
            className="mt-0.5 size-4 accent-blue" />
          <span className="text-sm leading-relaxed text-black/70">
            I accept the{' '}
            <Link href="/legal/terms" target="_blank" className="font-semibold text-blue underline">Terms &amp; Conditions</Link>,{' '}
            <Link href="/legal/privacy" target="_blank" className="font-semibold text-blue underline">Privacy Policy</Link>,{' '}
            <Link href="/legal/refunds" target="_blank" className="font-semibold text-blue underline">Refund &amp; Cancellation Policy</Link>{' '}
            and{' '}
            <Link href="/legal/acceptable-use" target="_blank" className="font-semibold text-blue underline">Acceptable Use Policy</Link>.
          </span>
        </label>

        {error && <p className="rounded-xl border border-red/30 bg-red/5 px-3.5 py-2.5 text-sm text-red">{error}</p>}
      </div>

      <aside className="h-fit rounded-2xl bg-navy p-6 text-white lg:sticky lg:top-20">
        <p className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-pale">Your booking</p>
        <p className="mt-2 font-display text-xl font-extrabold">{p.serviceTitle}</p>
        <p className="text-white/60">{p.studioName}</p>

        <dl className="mt-4 font-mono text-[13px]">
          <div className="flex justify-between border-b border-dashed border-white/20 py-2.5">
            <dt className="text-white/55">Design fee</dt><dd className="font-bold">{naira(p.priceKobo)}</dd>
          </div>
          <div className="flex justify-between border-b border-dashed border-white/20 py-2.5">
            <dt className="text-white/55">Platform</dt><dd className="font-bold">{naira(p.marginKobo + p.platformFeeKobo)}</dd>
          </div>
          <div className="flex justify-between py-2.5">
            <dt className="text-white/55">Total</dt>
            <dd className="font-display text-lg font-extrabold">{naira(p.totalKobo)}</dd>
          </div>
        </dl>

        <ul className="mt-2 space-y-1 text-xs text-white/60">
          <li>{p.revisionsIncluded} revision{p.revisionsIncluded === 1 ? '' : 's'} included</li>
          {p.extraRevisionKobo > 0 && <li>Extra revisions {naira(p.extraRevisionKobo)} each, paid separately</li>}
          <li>Around {p.turnaroundHours}h turnaround</li>
        </ul>

        <Button onClick={pay} disabled={!ready || busy} variant="secondary" className="mt-5 w-full">
          {busy ? 'Opening payment…' : `Pay ${naira(p.totalKobo)}`} <span aria-hidden>→</span>
        </Button>
      </aside>
    </div>
  );
}
