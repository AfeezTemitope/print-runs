'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Star } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Field';
import { submitReview } from './actions';

export function ReviewForm({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    setBusy(true);
    const res = await submitReview({ orderId, rating, comment: comment.trim() });
    setBusy(false);
    if (res?.error) { setError(res.error); return; }
    router.refresh();
  }

  return (
    <div className="mt-3">
      <div className="flex gap-1" role="radiogroup" aria-label="Rating">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} role="radio" aria-checked={rating === n} onClick={() => setRating(n)} aria-label={`${n} star${n > 1 ? 's' : ''}`}>
            <Star className={`size-7 ${n <= rating ? 'fill-pale text-navy' : 'text-black/25'}`} />
          </button>
        ))}
      </div>
      <Textarea className="mt-3" rows={2} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="How did it go? (optional)" />
      {error && <p className="mt-2 text-sm text-red">{error}</p>}
      <Button size="sm" className="mt-3" onClick={send} disabled={rating === 0 || busy}>
        {busy ? 'Sending…' : 'Submit rating'}
      </Button>
    </div>
  );
}
