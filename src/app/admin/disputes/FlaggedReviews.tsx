'use client';

import { useState, useTransition } from 'react';
import { Star } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { removeReview } from './actions';

export type FlaggedReview = {
  id: string; rating: number; comment: string | null;
  flagReason: string | null; printerName: string;
  removed: boolean; removedReason: string | null;
};

export function FlaggedReviews({ reviews }: { reviews: FlaggedReview[] }) {
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <ul className="mt-3 space-y-2">
      {reviews.map((r) => (
        <li key={r.id} className={`rounded-xl border bg-white px-4 py-3 ${r.removed ? 'border-dashed border-black/20 opacity-70' : 'border-black/12'}`}>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="flex items-center gap-1 font-display text-[13px] font-bold text-navy">
                {Array.from({ length: r.rating }).map((_, i) => (
                  <Star key={i} className="size-3.5 fill-current text-blue" />
                ))}
                <span className="ml-1 text-black/45">on {r.printerName}</span>
              </p>
              {r.comment && <p className="mt-1 text-[14px] text-black/70">{r.comment}</p>}
              {r.flagReason && <p className="mt-1 text-xs text-black/50">Printer says: {r.flagReason}</p>}
              {r.removed && <p className="mt-1 text-xs font-semibold text-red">Removed — {r.removedReason}</p>}
            </div>
          </div>

          {!r.removed && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Input className="!w-64" placeholder="Reason for removal"
                value={reasons[r.id] ?? ''}
                onChange={(e) => setReasons((p) => ({ ...p, [r.id]: e.target.value }))} />
              <Button size="sm" variant="tertiary" disabled={pending} onClick={() => {
                setError(null);
                start(async () => {
                  const res = await removeReview(r.id, reasons[r.id] ?? '');
                  if (res?.error) setError(res.error);
                });
              }}>
                Remove review
              </Button>
            </div>
          )}
        </li>
      ))}
      {error && <p className="text-sm text-red">{error}</p>}
    </ul>
  );
}
