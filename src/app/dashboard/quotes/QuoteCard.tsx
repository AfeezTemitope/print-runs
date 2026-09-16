'use client';

import { useState, useTransition } from 'react';
import { naira, shortDate } from '@/lib/format';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Field';
import { CodeBadge } from '@/components/ui/CodeBadge';
import { sendQuote } from './actions';

export type QuoteJob = {
  id: string; code: string; createdAt: string;
  listingName: string; specLine: string; note: string | null;
  contactEmail: string; contactPhone: string;
  designFileUrl: string | null;
  quotedPriceKobo: number | null;
  quotedAt: string | null;
  declined: boolean;
};

export function QuoteCard({ job }: { job: QuoteJob }) {
  const [price, setPrice] = useState(job.quotedPriceKobo ? String(job.quotedPriceKobo / 100) : '');
  const [note, setNote] = useState('');
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  return (
    <li className={`rounded-2xl border bg-white p-4 ${job.quotedAt ? 'border-black/12' : 'border-blue'}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <CodeBadge code={job.code} tone="light" />
            <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-black/45">
              {shortDate(job.createdAt)}
            </span>
          </div>
          <p className="mt-1 font-display font-extrabold text-navy">{job.listingName}</p>
          <p className="mt-0.5 text-[13px] text-black/55">{job.specLine}</p>
        </div>
        <div className="text-right">
          {job.declined ? (
            <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-red">Declined</span>
          ) : job.quotedAt ? (
            <>
              <p className="font-display font-extrabold text-navy">{naira(job.quotedPriceKobo)}</p>
              <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-black/45">
                Awaiting customer
              </span>
            </>
          ) : (
            <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-blue">Needs a price</span>
          )}
        </div>
      </div>

      {job.note && (
        <p className="mt-2.5 rounded-xl bg-pale/30 px-4 py-2.5 text-[14px] text-black/75">{job.note}</p>
      )}
      {job.designFileUrl && (
        <a href={job.designFileUrl} target="_blank" rel="noreferrer"
          className="mt-2 inline-block font-display text-[13px] font-bold text-blue underline">
          Open their file →
        </a>
      )}

      <div className="mt-3 border-t border-dashed border-black/20 pt-3">
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <span className="mb-1 block font-display text-[12px] font-bold text-navy">
              {job.quotedAt ? 'Revise your price' : 'Your price for this job'}
            </span>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-sm text-black/40">₦</span>
              <Input inputMode="numeric" value={price} placeholder="0" className="!w-36 !pl-7"
                onChange={(e) => { setPrice(e.target.value.replace(/\D/g, '')); setSent(false); }} />
            </div>
          </div>
          <Button size="sm" disabled={pending || !price} onClick={() => {
            setError(null);
            start(async () => {
              const res = await sendQuote(job.id, price, note);
              if (res?.error) setError(res.error); else setSent(true);
            });
          }}>
            {pending ? 'Sending…' : sent ? 'Sent' : 'Send quote'}
          </Button>
        </div>
        <Textarea rows={2} className="mt-2" value={note} onChange={(e) => setNote(e.target.value)}
          placeholder="Anything the customer should know (optional)" />
        <p className="mt-1.5 text-xs text-black/50">
          They&apos;ll see this price and pay only if they accept. PrintRuns adds its own fee on top —
          quote what you want to earn.
        </p>
      </div>

      <p className="mt-2 font-mono text-[11px] text-black/45">{job.contactEmail} · {job.contactPhone}</p>
      {error && <p className="mt-2 text-sm text-red">{error}</p>}
    </li>
  );
}
