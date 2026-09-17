'use client';

import { useState, useTransition } from 'react';
import { Star } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Select, Textarea } from '@/components/ui/Field';
import { PhotoUpload } from '@/components/ui/PhotoUpload';
import { leaveReview, raiseDispute } from './actions';

export type TrustState = {
  orderId: string;
  printerName: string;
  canReview: boolean;
  canDispute: boolean;
  disputeHoursLeft: number;
  disputeOpen: boolean;
  reviewed: boolean;
};

const REASONS = [
  ['not_delivered', 'Job not delivered'],
  ['wrong_product', 'Delivered but wrong product or size'],
  ['quality', 'Print quality is unacceptable'],
  ['damaged', 'Item damaged on delivery'],
  ['other', 'Something else'],
] as const;

/** What a customer can do in the window after delivery (§3 and §4). */
export function TrustPanel({ state }: { state: TrustState }) {
  const [mode, setMode] = useState<'none' | 'review' | 'dispute'>('none');
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [reason, setReason] = useState<(typeof REASONS)[number][0]>('quality');
  const [detail, setDetail] = useState('');
  const [evidence, setEvidence] = useState<string[]>([]);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  function run(fn: () => Promise<{ error?: string } | void>, message: string) {
    setError(null);
    start(async () => {
      const res = await fn();
      if (res && 'error' in res && res.error) setError(res.error);
      else { setDone(message); setMode('none'); }
    });
  }

  if (done) return <p className="mt-3 text-[13px] font-semibold text-success">{done}</p>;

  if (state.disputeOpen) {
    return (
      <p className="mt-3 rounded-xl border border-red/30 bg-red/5 px-4 py-3 text-[13px] text-navy">
        Your dispute is with PrintRuns. The printer&apos;s payment is frozen while we look into it,
        and we&apos;ll email you with a decision.
      </p>
    );
  }

  if (!state.canReview && !state.canDispute) return null;

  return (
    <div className="mt-3">
      {mode === 'none' && (
        <div className="flex flex-wrap items-center gap-2">
          {state.canReview && (
            <Button size="sm" variant="tertiary" onClick={() => setMode('review')}>
              {state.reviewed ? 'Reviewed' : 'Leave a review'}
            </Button>
          )}
          {state.canDispute && (
            <>
              <Button size="sm" variant="tertiary" onClick={() => setMode('dispute')}>
                Something&apos;s wrong
              </Button>
              {/* §4.1: the deadline is stated plainly, because after it nothing can be raised. */}
              <span className="font-mono text-[11px] text-black/45">
                {state.disputeHoursLeft}h left to report a problem
              </span>
            </>
          )}
        </div>
      )}

      {mode === 'review' && (
        <div className="rounded-xl border border-black/12 bg-white p-4">
          <p className="font-display text-[15px] font-extrabold text-navy">How was {state.printerName}?</p>
          <div className="mt-2 flex gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} onClick={() => setRating(n)} aria-label={`${n} star${n > 1 ? 's' : ''}`}>
                <Star className={`size-7 ${n <= rating ? 'fill-current text-blue' : 'text-black/20'}`} />
              </button>
            ))}
          </div>
          <Textarea rows={3} className="mt-2" value={comment} onChange={(e) => setComment(e.target.value)}
            placeholder="Anything you'd tell another customer (optional)" />
          <p className="mt-1.5 text-xs text-black/50">
            Reviews are public and permanent — the printer can&apos;t edit or delete them.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button size="sm" disabled={pending || rating === 0}
              onClick={() => run(() => leaveReview(state.orderId, rating, comment), 'Thanks — your review is live.')}>
              Post review
            </Button>
            <Button size="sm" variant="tertiary" onClick={() => setMode('none')}>Cancel</Button>
          </div>
        </div>
      )}

      {mode === 'dispute' && (
        <div className="rounded-xl border border-red/30 bg-red/5 p-4">
          <p className="font-display text-[15px] font-extrabold text-navy">What went wrong?</p>
          <Select className="mt-2" value={reason} aria-label="Reason"
            onChange={(e) => setReason(e.target.value as typeof reason)}>
            {REASONS.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
          </Select>
          <Textarea rows={3} className="mt-2" value={detail} onChange={(e) => setDetail(e.target.value)}
            placeholder="Tell us what happened" />
          <div className="mt-2">
            <p className="mb-1.5 font-display text-[12px] font-bold text-navy">Photos of what you received</p>
            <PhotoUpload kind="products" label="Evidence" aspect="aspect-[3/2]"
              onChange={(url) => { if (url) setEvidence((p) => [...p, url].slice(0, 5)); }} />
            {evidence.length > 0 && (
              <p className="mt-1 font-mono text-[11px] text-black/45">{evidence.length} photo(s) attached</p>
            )}
          </div>
          <p className="mt-2 text-xs text-black/55">
            The printer&apos;s payment is frozen as soon as you submit, and they get 24 hours to
            respond before we decide.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button size="sm" disabled={pending}
              onClick={() => run(() => raiseDispute(state.orderId, reason, detail, evidence), 'Reported. We\u2019ll be in touch.')}>
              Submit
            </Button>
            <Button size="sm" variant="tertiary" onClick={() => setMode('none')}>Cancel</Button>
          </div>
        </div>
      )}

      {error && <p className="mt-2 text-sm text-red">{error}</p>}
    </div>
  );
}
