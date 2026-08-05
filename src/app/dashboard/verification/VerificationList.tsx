'use client';

import { useRef, useState, useTransition } from 'react';
import { BadgeCheck, Clock, FileUp, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { requestVerification } from './actions';

export type CatRow = {
  slug: string;
  name: string;
  code: string;
  status: 'none' | 'pending' | 'verified' | 'rejected';
};

const BADGE = {
  verified: { icon: BadgeCheck, text: 'Verified', cls: 'text-success' },
  pending: { icon: Clock, text: 'Under review', cls: 'text-navy/60' },
  rejected: { icon: XCircle, text: 'Not approved', cls: 'text-red' },
} as const;

function Row({ row }: { row: CatRow }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  async function apply(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    const fd = new FormData();
    fd.append('file', file);
    fd.append('kind', 'permit');
    try {
      const res = await fetch('/api/upload/image', { method: 'POST', body: fd });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? 'Upload failed.'); return; }
      start(async () => {
        const out = await requestVerification(row.slug, json.url);
        if (out?.error) setError(out.error);
      });
    } catch {
      setError('Upload failed — check your connection.');
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  }

  const badge = row.status !== 'none' ? BADGE[row.status] : null;
  const Icon = badge?.icon;

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-black/12 bg-white p-4">
      <div>
        <p className="font-display text-[15px] font-extrabold text-navy">{row.name}</p>
        {badge && Icon && (
          <p className={`mt-0.5 flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-widest ${badge.cls}`}>
            <Icon className="size-3.5" /> {badge.text}
          </p>
        )}
        {row.status === 'rejected' && (
          <p className="mt-1 text-xs text-black/55">Usually a permit that was hard to read. Upload a clearer copy to re-apply.</p>
        )}
      </div>

      {row.status !== 'verified' && (
        <>
          <input ref={input} type="file" hidden accept=".pdf,image/png,image/jpeg"
            onChange={(e) => apply(e.target.files?.[0])} />
          <Button size="sm" variant="tertiary" disabled={busy || pending} onClick={() => input.current?.click()}>
            <FileUp className="size-4" />
            {busy || pending ? 'Sending…' : row.status === 'none' ? 'Apply' : 'Re-upload permit'}
          </Button>
        </>
      )}
      {error && <p className="w-full text-xs text-red">{error}</p>}
    </li>
  );
}

export function VerificationList({ rows }: { rows: CatRow[] }) {
  return <ul className="mt-6 grid gap-3 sm:grid-cols-2">{rows.map((r) => <Row key={r.slug} row={r} />)}</ul>;
}
