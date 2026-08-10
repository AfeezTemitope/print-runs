'use client';

import { useState, useTransition } from 'react';
import Image from 'next/image';
import { naira } from '@/lib/format';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Field';
import { approveProof, requestRevision } from '../actions';

export type ReviewProps = {
  orderId: string;
  status: string;
  reviewMode: string;
  freeLeft: number;
  paidUnconsumed: number;
  extraRevisionKobo: number;
  latestProof: { round: number; fileUrl: string; note: string | null } | null;
};

export function ProofReview(p: ReviewProps) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [asking, setAsking] = useState(false);
  const [paying, setPaying] = useState(false);

  function run(fn: () => Promise<{ error?: string } | void>) {
    setError(null);
    start(async () => {
      const res = await fn();
      if (res && 'error' in res && res.error) setError(res.error);
      else setAsking(false);
    });
  }

  async function payForExtra() {
    setPaying(true);
    setError(null);
    try {
      const res = await fetch('/api/design/revision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: p.orderId }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? 'Could not start payment.'); return; }
      window.location.href = json.authorizationUrl;
    } catch {
      setError('Could not reach the payment page.');
    } finally {
      setPaying(false);
    }
  }

  if (p.status !== 'proof_ready' || !p.latestProof) return null;

  const canAskFree = p.freeLeft > 0;
  const canAskPaid = p.paidUnconsumed > 0;

  return (
    <section className="mt-6 rounded-2xl border border-blue bg-white p-5">
      <p className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-blue">
        Proof {p.latestProof.round} — your review
      </p>

      <div className="relative mt-3 aspect-[4/3] overflow-hidden rounded-xl border border-black/12 bg-pale/30">
        <Image src={p.latestProof.fileUrl} alt={`Proof ${p.latestProof.round}`} fill sizes="640px" className="object-contain" />
      </div>
      {p.latestProof.note && <p className="mt-2 text-[14px] text-black/70">{p.latestProof.note}</p>}

      <p className="mt-3 rounded-xl bg-pale/40 px-4 py-3 text-[13px] leading-relaxed text-navy">
        Check spelling, names, dates and phone numbers carefully. Once you approve, this version goes
        to print — errors visible in an approved proof can&apos;t be refunded.
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" disabled={pending} onClick={() => run(() => approveProof(p.orderId))}>
          Approve this design
        </Button>
        <Button size="sm" variant="tertiary" onClick={() => setAsking((a) => !a)}>
          {asking ? 'Cancel' : 'Request changes'}
        </Button>
      </div>

      {asking && (
        <div className="mt-3">
          {canAskFree || canAskPaid ? (
            <>
              <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)}
                placeholder="What should change?" />
              <p className="mt-1.5 text-xs text-black/55">
                {canAskFree
                  ? `${p.freeLeft} included revision${p.freeLeft === 1 ? '' : 's'} left.`
                  : 'This will use the extra revision you paid for.'}
              </p>
              <Button size="sm" className="mt-2" disabled={pending}
                onClick={() => run(() => requestRevision(p.orderId, note))}>
                Send to designer
              </Button>
            </>
          ) : (
            <div className="rounded-xl border border-black/12 p-3.5">
              <p className="text-[14px] text-black/70">
                You&apos;ve used all {p.freeLeft === 0 ? 'your included' : ''} revisions.
                {p.extraRevisionKobo > 0
                  ? ` An extra revision costs ${naira(p.extraRevisionKobo)}, paid separately.`
                  : ' This designer doesn\u2019t offer extra revisions — contact support if something is wrong.'}
              </p>
              {p.extraRevisionKobo > 0 && (
                <Button size="sm" className="mt-2" disabled={paying} onClick={payForExtra}>
                  {paying ? 'Opening payment…' : `Pay ${naira(p.extraRevisionKobo)} for an extra revision`}
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      {error && <p className="mt-2 text-sm text-red">{error}</p>}
    </section>
  );
}
