'use client';

import { useState, useTransition } from 'react';
import { AlertTriangle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { resubmitFile, overridePreflight } from './actions';

export type PanelState = {
  orderId: string;
  reviewStatus: 'pending' | 'failed';
  issues: string[];
  reviewerNote: string | null;
  round: number;
};

/** What the customer sees while an order is paused (§3.2 and §6.2). */
export function PreflightPanel({ state }: { state: PanelState }) {
  const [pending, start] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [accepted, setAccepted] = useState(false);

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
    start(async () => {
      const out = await resubmitFile(state.orderId, json.url, json.name);
      if (out?.error) setError(out.error);
    });
  }

  if (state.reviewStatus === 'pending') {
    return (
      <div className="mt-3 rounded-xl border border-blue/30 bg-blue/5 p-4">
        <p className="flex items-center gap-2 font-display text-[15px] font-extrabold text-navy">
          <Clock className="size-4 text-blue" />
          We&apos;re checking your file
        </p>
        <p className="mt-1 text-[13px] text-black/65">
          {state.round > 1 ? 'Your new file is being checked. ' : ''}
          Usually done within 1–2 hours. Your printer hasn&apos;t received the order yet — we&apos;ll send
          it as soon as your file passes.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-xl border border-red/30 bg-red/5 p-4">
      <p className="flex items-center gap-2 font-display text-[15px] font-extrabold text-navy">
        <AlertTriangle className="size-4 text-red" />
        Your file needs a fix
      </p>
      <ul className="mt-2 space-y-1.5">
        {state.issues.map((issue, i) => (
          <li key={i} className="flex gap-2 text-[14px] leading-relaxed text-black/75">
            <span aria-hidden className="mt-1.5 size-1.5 shrink-0 rounded-pill bg-red" />
            <span>{issue}</span>
          </li>
        ))}
      </ul>
      {state.reviewerNote && <p className="mt-2 text-[14px] text-black/70">{state.reviewerNote}</p>}

      <p className="mt-3 text-[13px] text-black/60">
        Nothing has been printed. Your printer still hasn&apos;t seen this order.
      </p>

      {!confirming ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <label className="inline-flex">
            <input type="file" hidden accept=".pdf,.ai,.cdr,.png,.jpg,.jpeg"
              onChange={(e) => onFile(e.target.files?.[0])} />
            <span className="cursor-pointer rounded-pill bg-blue px-5 py-2.5 font-display text-sm font-bold text-white">
              {uploading || pending ? 'Uploading…' : 'Fix and resubmit'}
            </span>
          </label>
          <Button size="sm" variant="tertiary" onClick={() => setConfirming(true)}>
            Send to printer anyway
          </Button>
        </div>
      ) : (
        <div className="mt-3 rounded-xl border border-black/15 bg-white p-3.5">
          <label className="flex items-start gap-3">
            <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)}
              className="mt-0.5 size-4 accent-blue" />
            <span className="text-[13px] leading-relaxed text-black/75">
              I understand that my file did not pass the PrintRuns print check. I accept that any
              print quality issues resulting from file problems are my responsibility and may not
              be eligible for a reprint or refund.
            </span>
          </label>
          <div className="mt-2.5 flex flex-wrap gap-2">
            <Button size="sm" disabled={!accepted || pending}
              onClick={() => start(async () => {
                const res = await overridePreflight(state.orderId, accepted);
                if (res?.error) setError(res.error);
              })}>
              Confirm and send
            </Button>
            <Button size="sm" variant="tertiary" onClick={() => setConfirming(false)}>Back</Button>
          </div>
        </div>
      )}

      <p className="mt-2 text-xs text-black/50">Re-checks are free, however many times you resubmit.</p>
      {error && <p className="mt-2 text-sm text-red">{error}</p>}
    </div>
  );
}
