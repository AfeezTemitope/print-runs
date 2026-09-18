'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { reviewVerificationSubmission } from '@/app/admin/disputes/actions';

export function ReviewSubmission({ id }: { id: string }) {
  const [note, setNote] = useState('');
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(decision: 'verified' | 'rejected') {
    setError(null);
    start(async () => {
      const res = await reviewVerificationSubmission(id, decision, note);
      if (res?.error) setError(res.error);
    });
  }

  return (
    <div className="mt-3 border-t border-dashed border-black/20 pt-3">
      <Input value={note} onChange={(e) => setNote(e.target.value)}
        placeholder="Note to the printer (required if rejecting)" />
      <div className="mt-2 flex flex-wrap gap-2">
        <Button size="sm" disabled={pending} onClick={() => run('verified')}>Approve — grant badge</Button>
        <Button size="sm" variant="tertiary" disabled={pending} onClick={() => run('rejected')}>Reject</Button>
      </div>
      {error && <p className="mt-2 text-sm text-red">{error}</p>}
    </div>
  );
}
