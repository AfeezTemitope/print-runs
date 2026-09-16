'use client';

import { useState, useTransition } from 'react';
import { shortDate } from '@/lib/format';
import { CHECKLIST } from '@/lib/preflight';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Field';
import { CodeBadge } from '@/components/ui/CodeBadge';
import { passReview, failReview } from './actions';

export type QueueItem = {
  reviewId: string;
  round: number;
  orderCode: string;
  submittedAt: string;
  fileUrl: string;
  fileName: string | null;
  listingName: string;
  specLine: string;
  printerName: string;
  waitingHours: number;
};

export function ReviewCard({ item }: { item: QueueItem }) {
  const [failing, setFailing] = useState(false);
  const [checks, setChecks] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(fn: () => Promise<{ error?: string } | void>) {
    setError(null);
    start(async () => {
      const res = await fn();
      if (res && 'error' in res && res.error) setError(res.error);
    });
  }

  // Target is 1–2 hours (§3.3), so anything past two is the thing to do next.
  const late = item.waitingHours >= 2;

  return (
    <li className={`rounded-2xl border bg-white p-4 ${late ? 'border-red' : 'border-blue'}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <CodeBadge code={item.orderCode} tone="light" />
            <span className={`font-mono text-[10px] font-bold uppercase tracking-widest ${late ? 'text-red' : 'text-black/45'}`}>
              waiting {item.waitingHours < 1 ? 'under an hour' : `${item.waitingHours}h`}
            </span>
            {item.round > 1 && (
              <span className="rounded-pill bg-pale px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-widest text-navy">
                resubmission {item.round}
              </span>
            )}
          </div>
          <p className="mt-1 font-display font-extrabold text-navy">{item.listingName}</p>
          <p className="mt-0.5 text-[13px] text-black/55">
            {item.specLine} · for {item.printerName} · {shortDate(item.submittedAt)}
          </p>
        </div>
        <a href={item.fileUrl} target="_blank" rel="noreferrer"
          className="rounded-pill bg-navy px-4 py-2 font-display text-[13px] font-bold text-white">
          Open file
        </a>
      </div>

      <div className="mt-3 border-t border-dashed border-black/20 pt-3">
        {!failing ? (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={pending} onClick={() => run(() => passReview(item.reviewId, note))}>
              Pass — send to printer
            </Button>
            <Button size="sm" variant="tertiary" onClick={() => setFailing(true)}>Fail</Button>
          </div>
        ) : (
          <>
            <p className="mb-2 font-display text-[13px] font-bold text-navy">Which checks failed?</p>
            <ul className="space-y-1.5">
              {CHECKLIST.map((c) => (
                <li key={c.key}>
                  <label className="flex items-start gap-2.5">
                    <input type="checkbox" className="mt-0.5 size-4 accent-blue"
                      checked={checks.includes(c.key)}
                      onChange={(e) => setChecks((prev) =>
                        e.target.checked ? [...prev, c.key] : prev.filter((k) => k !== c.key))} />
                    <span>
                      <span className="font-display text-[13px] font-bold text-navy">{c.label}</span>
                      <span className="block text-xs text-black/50">{c.reviews}</span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
            <Textarea rows={2} className="mt-2.5" value={note} onChange={(e) => setNote(e.target.value)}
              placeholder="Anything specific to add, in plain language (optional)" />
            <div className="mt-2 flex flex-wrap gap-2">
              <Button size="sm" disabled={pending || !checks.length}
                onClick={() => run(() => failReview(item.reviewId, checks, note))}>
                Send failure to customer
              </Button>
              <Button size="sm" variant="tertiary" onClick={() => setFailing(false)}>Back</Button>
            </div>
          </>
        )}
      </div>

      {error && <p className="mt-2 text-sm text-red">{error}</p>}
    </li>
  );
}
