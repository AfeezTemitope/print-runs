'use client';

import { useState, useTransition } from 'react';
import { Flag } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { flagReview } from '@/app/dashboard/verify/actions';

/**
 * §3.4: a printer may escalate a review they believe is fraudulent. This does NOT hide it —
 * reviews are public and permanent, and only an admin can remove one. Making that explicit
 * here avoids a printer expecting the review to disappear.
 */
export function FlagReview({ reviewId, flagged }: { reviewId: string; flagged: boolean }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(flagged);

  if (sent) {
    return (
      <p className="mt-1.5 font-mono text-[10px] font-bold uppercase tracking-widest text-black/45">
        Flagged for review
      </p>
    );
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className="mt-1.5 flex items-center gap-1 font-mono text-[10px] font-bold uppercase tracking-widest text-black/40 hover:text-blue">
        <Flag className="size-3" /> Flag this review
      </button>
    );
  }

  return (
    <div className="mt-2">
      <Input value={reason} onChange={(e) => setReason(e.target.value)}
        placeholder="Why do you believe this review is unfair or fake?" />
      <p className="mt-1 text-xs text-black/50">
        This escalates it to PrintRuns. It stays visible unless an admin removes it.
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <Button size="sm" disabled={pending || reason.trim().length < 5} onClick={() => {
          setError(null);
          start(async () => {
            const res = await flagReview(reviewId, reason);
            if (res?.error) setError(res.error); else setSent(true);
          });
        }}>
          Send to PrintRuns
        </Button>
        <Button size="sm" variant="tertiary" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
      {error && <p className="mt-2 text-sm text-red">{error}</p>}
    </div>
  );
}
