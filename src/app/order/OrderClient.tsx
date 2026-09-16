'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FileCheck2, PenTool, UploadCloud, X } from 'lucide-react';
import { naira } from '@/lib/format';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select, Textarea } from '@/components/ui/Field';

export type OrderSummary = {
  listingId: string;
  listingName: string;
  shopName: string;
  shopSlug: string;
  specLine: string;
  turnaroundHours: number;
  isQuote: boolean;
  printerBaseKobo: number;
  marginKobo: number;
  platformFeeKobo: number;
  totalKobo: number;
  qty: number;
  width?: number;
  height?: number;
  designUrl?: string;
  designName?: string;
  designCode?: string;
  defaultEmail: string;
};

/** Lagos LGAs — the delivery fee depends on which one, so it is a choice, not free text. */
const LAGOS_LGAS = [
  'Agege', 'Ajeromi-Ifelodun', 'Alimosho', 'Amuwo-Odofin', 'Apapa', 'Badagry', 'Epe',
  'Eti-Osa', 'Ibeju-Lekki', 'Ifako-Ijaiye', 'Ikeja', 'Ikorodu', 'Kosofe', 'Lagos Island',
  'Lagos Mainland', 'Mushin', 'Ojo', 'Oshodi-Isolo', 'Shomolu', 'Surulere',
];

export function OrderClient({ summary }: { summary: OrderSummary }) {
  const router = useRouter();

  // Module 2 §6.3: structured, not one free-text blob. A rider needs the area and LGA to
  // find the place, and ops needs them to quote a delivery fee at all.
  const [street, setStreet] = useState('');
  const [area, setArea] = useState('');
  const [lga, setLga] = useState('');
  const [state, setState] = useState('Lagos');
  const [addressConfirmed, setAddressConfirmed] = useState(false);
  const [email, setEmail] = useState(summary.defaultEmail);
  const [phone1, setPhone1] = useState('');
  const [phone2, setPhone2] = useState('');
  const [note, setNote] = useState('');
  // Up to 3 files (§6.2) — front and back is the common case, so a single slot forces
  // customers to flatten two artworks into one file or give up.
  const [files, setFiles] = useState<{ url: string; name: string }[]>(
    summary.designUrl ? [{ url: summary.designUrl, name: summary.designName ?? 'Your design' }] : [],
  );
  const [designAccurate, setDesignAccurate] = useState(false);
  const [designCmyk, setDesignCmyk] = useState(false);
  const [preflight, setPreflight] = useState<'check' | 'send' | null>(null);
  const [legalAccepted, setLegalAccepted] = useState(false);

  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const address = [street, area, lga, state].filter(Boolean).join(', ');

  const ready =
    street.trim().length >= 4
    && area.trim().length >= 2
    && addressConfirmed
    && email.includes('@')
    && phone1.replace(/\D/g, '').length >= 7
    // Phone 2 stays REQUIRED. The spec calls it optional, but delivery is arranged by phone
    // and paid in cash on arrival — one unreachable number should not strand a paid job.
    && phone2.replace(/\D/g, '').length >= 7
    && legalAccepted
    && (summary.isQuote || (designAccurate && designCmyk && files.length > 0 && preflight !== null));

  async function onFile(f: File | undefined) {
    if (!f) return;
    setUploading(true);
    setError(null);
    const fd = new FormData();
    fd.append('file', f);
    const res = await fetch('/api/upload', { method: 'POST', body: fd });
    const json = await res.json();
    setUploading(false);
    if (!res.ok) { setError(json.error ?? 'Upload failed.'); return; }
    setFiles((prev) => [...prev, { url: json.url, name: json.name }].slice(0, 3));
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listing: summary.listingId,
          qty: String(summary.qty),
          w: summary.width ? String(summary.width) : '',
          h: summary.height ? String(summary.height) : '',
          quote: summary.isQuote ? '1' : '',
          deliveryAddress: address,
          addressConfirmed: addressConfirmed ? 'true' : 'false',
          preflight: preflight === 'check' ? '1' : '',
          contactEmail: email,
          contactPhonePrimary: phone1,
          contactPhoneSecondary: phone2,
          note,
          file: files[0]?.url ?? '',
          fileName: files.map((f) => f.name).join(', '),
          extraFiles: files.slice(1).map((f) => f.url).join(','),
          designAccurate: designAccurate ? 'true' : 'false',
          designCmyk: designCmyk ? 'true' : 'false',
          legalAccepted: legalAccepted ? 'true' : 'false',
        }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? 'Could not place the order.'); return; }
      if (json.quote) router.push(`/orders?quote=${json.code}`);
      else window.location.href = json.authorizationUrl;
    } catch {
      setError('Could not reach the server. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
      <div className="space-y-5 rounded-2xl border border-black/12 bg-white p-5 sm:p-7">
        <div>
          <span className="mb-2 block font-display text-[13px] font-bold text-navy">Design file</span>
          <p className="mb-2 text-xs text-black/55">
            Printing front and back? Upload one file with both pages, or two files — one for
            each side. Up to 3.
          </p>

          {files.length > 0 && (
            <ul className="mb-2 space-y-2">
              {files.map((f) => (
                <li key={f.url} className="flex items-center justify-between rounded-xl border border-success/40 bg-success/5 px-4 py-3">
                  <span className="flex items-center gap-2 text-sm font-semibold text-navy">
                    <FileCheck2 className="size-4 text-success" /> {f.name}
                  </span>
                  <button onClick={() => setFiles((prev) => prev.filter((x) => x.url !== f.url))}
                    aria-label={`Remove ${f.name}`} className="text-black/40 hover:text-red">
                    <X className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {files.length < 3 && (
            <label className="flex cursor-pointer flex-col items-center gap-1.5 rounded-xl border border-dashed border-black/30 bg-pale/25 px-4 py-7 text-center transition-colors hover:bg-pale/50">
              <input type="file" hidden accept=".pdf,.ai,.cdr,.png,.jpg,.jpeg" onChange={(e) => onFile(e.target.files?.[0])} />
              <UploadCloud className="size-6 text-navy" />
              <span className="font-display text-sm font-bold text-navy">
                {uploading ? 'Uploading…' : files.length ? 'Add another file' : 'Drop your file or tap to browse'}
              </span>
              <span className="font-mono text-[10px] uppercase tracking-widest text-black/45">PDF, AI, CDR, PNG, JPG · CMYK preferred</span>
            </label>
          )}

          {summary.designCode && files.some((f) => f.url === summary.designUrl) && (
            <p className="mt-2 rounded-xl border border-blue/30 bg-blue/5 px-3.5 py-2 text-[13px] text-navy">
              Using your approved design from {summary.designCode}.
            </p>
          )}

          {/*
            Request Designer sits here rather than on the homepage — this is the moment a
            customer discovers they have nothing to upload.
          */}
          {!files.length && (
            <Link href="/designers"
              className="mt-2.5 flex items-center gap-2 rounded-xl border border-black/15 px-4 py-3 text-[13px] text-navy transition-colors hover:border-blue">
              <PenTool className="size-4 text-blue" />
              <span><strong className="font-display font-extrabold">No design yet?</strong> Work with a PrintRuns designer first.</span>
            </Link>
          )}
        </div>

        {!summary.isQuote && files.length > 0 && (
          <div>
            <span className="mb-2 block font-display text-[13px] font-bold text-navy">
              Before we send it to the printer
            </span>
            {/*
              Module 3 §2: both options equally visible. Neither is the default and neither is
              styled as secondary — the customer makes an active choice, and the form will not
              proceed until they do.
            */}
            <div className="space-y-2">
              {([
                ['check', 'Check my file before printing', "We'll review it for print readiness within 1–2 hours. Free."],
                ['send', 'My design is ready — send to printer', 'Skip the check. You confirm your file is print-ready.'],
              ] as const).map(([value, title, hint]) => (
                <button key={value} onClick={() => setPreflight(value)}
                  className={`flex w-full flex-col gap-0.5 rounded-2xl border px-4 py-3 text-left transition-colors ${
                    preflight === value ? 'border-blue bg-blue text-white' : 'border-black/15 text-navy hover:border-black/35'
                  }`}>
                  <span className="font-display text-sm font-extrabold">{title}</span>
                  <span className={`text-xs ${preflight === value ? 'text-white/75' : 'text-black/45'}`}>{hint}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <Field label="Street address">
          <Input value={street} onChange={(e) => setStreet(e.target.value)} placeholder="14 Admiralty Way" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Area"><Input value={area} onChange={(e) => setArea(e.target.value)} placeholder="Lekki Phase 1" /></Field>
          <Field label="LGA">
            <Select value={lga} onChange={(e) => setLga(e.target.value)}>
              <option value="">Select…</option>
              {LAGOS_LGAS.map((l) => <option key={l}>{l}</option>)}
            </Select>
          </Field>
          <Field label="State"><Input value={state} onChange={(e) => setState(e.target.value)} /></Field>
        </div>
        <label className="flex items-start gap-3">
          <input type="checkbox" checked={addressConfirmed} onChange={(e) => setAddressConfirmed(e.target.checked)}
            className="mt-0.5 size-4 accent-blue" />
          <span className="text-sm text-black/70">I confirm this address is correct.</span>
        </label>

        <Field label="Email"><Input value={email} onChange={(e) => setEmail(e.target.value)} /></Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Phone"><Input value={phone1} onChange={(e) => setPhone1(e.target.value)} placeholder="0803…" /></Field>
          <Field label="Second phone" hint="Required — delivery is arranged by phone.">
            <Input value={phone2} onChange={(e) => setPhone2(e.target.value)} placeholder="0701…" />
          </Field>
        </div>

        <Field label="Note for the printer (optional)">
          <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>

        {!summary.isQuote && (
          <div className="space-y-2.5 border-t border-dashed border-black/20 pt-3.5">
            {/* Two separate assertions, because they are two different things to have checked. */}
            <label className="flex items-start gap-3">
              <input type="checkbox" checked={designAccurate} onChange={(e) => setDesignAccurate(e.target.checked)}
                className="mt-0.5 size-4 accent-blue" />
              <span className="text-sm leading-relaxed text-black/70">
                My design is accurate — spelling, names, dates, sizes and quantity are all correct.
              </span>
            </label>
            <label className="flex items-start gap-3">
              <input type="checkbox" checked={designCmyk} onChange={(e) => setDesignCmyk(e.target.checked)}
                className="mt-0.5 size-4 accent-blue" />
              <span className="text-sm leading-relaxed text-black/70">
                My file is in CMYK and good resolution for the size I&apos;m ordering.
              </span>
            </label>
          </div>
        )}

        <label className={`flex items-start gap-3 ${summary.isQuote ? 'border-t border-dashed border-black/20 pt-3.5' : ''}`}>
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
        <p className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-pale">Your order</p>
        <p className="mt-2 font-display text-xl font-extrabold leading-tight">{summary.listingName}</p>
        <Link href={`/${summary.shopSlug}`} className="text-white/60 hover:text-pale">{summary.shopName}</Link>

        <dl className="mt-4 font-mono text-[13px]">
          <div className="flex justify-between border-b border-dashed border-white/20 py-2.5">
            <dt className="text-white/55">Spec</dt><dd className="font-bold">{summary.specLine}</dd>
          </div>
          {summary.isQuote ? (
            <div className="flex justify-between py-2.5">
              <dt className="text-white/55">Price</dt><dd className="font-bold">On request</dd>
            </div>
          ) : (
            <>
              <div className="flex justify-between border-b border-dashed border-white/20 py-2.5">
                <dt className="text-white/55">Printing</dt>
                <dd className="font-bold">{naira(summary.printerBaseKobo + summary.marginKobo)}</dd>
              </div>
              <div className="flex justify-between border-b border-dashed border-white/20 py-2.5">
                <dt className="text-white/55">Platform fee</dt><dd className="font-bold">{naira(summary.platformFeeKobo)}</dd>
              </div>
              <div className="flex justify-between py-2.5">
                <dt className="text-white/55">Total</dt>
                <dd className="font-display text-lg font-extrabold">{naira(summary.totalKobo)}</dd>
              </div>
            </>
          )}
        </dl>

        {/*
          Delivery is deliberately absent from this total. The printer quotes it after the job
          is under way and a rep confirms it by phone; the customer pays the rider in cash.
          Showing a delivery line here would imply it is being charged now.
        */}
        <p className="mt-2 text-xs leading-relaxed text-white/60">
          Delivery is arranged after printing. A PrintRuns representative will call to confirm the
          fee, which you pay the rider in cash on arrival — it is not charged to your card.
        </p>
        <p className="mt-1.5 font-mono text-[11px] uppercase tracking-widest text-pale/70">
          Ready in about {summary.turnaroundHours}hrs
        </p>

        <Button onClick={submit} disabled={!ready || busy} variant="secondary" className="mt-5 w-full">
          {busy
            ? 'Working…'
            : summary.isQuote ? <>Send quote request <span aria-hidden>→</span></>
            : <>Pay {naira(summary.totalKobo)} <span aria-hidden>→</span></>}
        </Button>
      </aside>
    </div>
  );
}
