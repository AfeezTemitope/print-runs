'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/Button';
import { reviewVerification } from './actions';

export function ReviewButtons({ id }: { id: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(decision: 'verified' | 'rejected') {
    setError(null);
    start(async () => {
      const res = await reviewVerification(id, decision);
      if (res?.error) setError(res.error);
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button size="sm" disabled={pending} onClick={() => run('verified')}>Approve</Button>
      <Button size="sm" variant="tertiary" disabled={pending} onClick={() => run('rejected')}>Reject</Button>
      {error && <span className="text-xs text-red">{error}</span>}
    </div>
  );
}
