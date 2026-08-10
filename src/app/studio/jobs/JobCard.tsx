'use client';

import { useState, useTransition } from 'react';
import { naira, shortDate } from '@/lib/format';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { PhotoUpload } from '@/components/ui/PhotoUpload';
import { CodeBadge } from '@/components/ui/CodeBadge';
import { startWork, submitProof } from './actions';

export type Job = {
  id: string; code: string; serviceTitle: string; status: string; reviewMode: string;
  brief: string; briefFileUrl: string | null; contactEmail: string; contactPhone: string;
  designerBaseKobo: number; revisionsIncluded: number; revisionsUsed: number;
  createdAt: string; latestRevisionNote: string | null; rounds: number;
};

const STATUS: Record<string, string> = {
  brief_received: 'New brief',
  in_progress: 'In progress',
  proof_ready: 'Waiting on the customer',
  revision_requested: 'Changes requested',
  approved: 'Approved',
  cancelled: 'Cancelled',
};

export function JobCard({ job }: { job: Job }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [open, setOpen] = useState(false);

  function run(fn: () => Promise<{ error?: string } | void>) {
    setError(null);
    start(async () => {
      const res = await fn();
      if (res && 'error' in res && res.error) setError(res.error);
      else setOpen(false);
    });
  }

  const canSend = ['brief_received', 'in_progress', 'revision_requested'].includes(job.status);

  return (
    <li className="rounded-2xl border border-black/12 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <CodeBadge code={job.code} tone="light" />
            <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-black/45">
              {shortDate(job.createdAt)}
            </span>
          </div>
          <p className="mt-1 font-display font-extrabold text-navy">{job.serviceTitle}</p>
          <p className="mt-0.5 text-[13px] text-black/55">
            {STATUS[job.status] ?? job.status}
            {job.reviewMode === 'direct' ? ' · direct to print' : ` · proof ${job.rounds || 0}`}
            {' · '}{job.revisionsUsed}/{job.revisionsIncluded} revisions used
          </p>
        </div>
        <p className="font-display font-extrabold text-navy">{naira(job.designerBaseKobo)}</p>
      </div>

      <div className="mt-3 rounded-xl bg-pale/30 px-4 py-3">
        <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-black/45">Brief</p>
        <p className="mt-1 whitespace-pre-line text-[14px] leading-relaxed text-black/75">{job.brief}</p>
        {job.briefFileUrl && (
          <a href={job.briefFileUrl} target="_blank" rel="noreferrer"
            className="mt-2 inline-block font-display text-[13px] font-bold text-blue underline">
            Open attached reference →
          </a>
        )}
      </div>

      {job.status === 'revision_requested' && job.latestRevisionNote && (
        <div className="mt-2.5 rounded-xl border border-blue/30 bg-blue/5 px-4 py-3">
          <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-blue">Requested changes</p>
          <p className="mt-1 whitespace-pre-line text-[14px] text-black/75">{job.latestRevisionNote}</p>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-dashed border-black/20 pt-3">
        {job.status === 'brief_received' && (
          <Button size="sm" variant="tertiary" disabled={pending} onClick={() => run(() => startWork(job.id))}>
            Start work
          </Button>
        )}
        {canSend && (
          <Button size="sm" onClick={() => setOpen((o) => !o)}>
            {open ? 'Cancel' : job.reviewMode === 'direct' ? 'Send final design' : 'Send proof'}
          </Button>
        )}
        {job.status === 'proof_ready' && (
          <p className="text-[13px] text-black/55">Waiting on the customer to approve or ask for changes.</p>
        )}
        {job.status === 'approved' && (
          <p className="text-[13px] font-semibold text-success">Approved — included in your next settlement.</p>
        )}
        <a href={`mailto:${job.contactEmail}`} className="ml-auto font-mono text-[11px] text-black/45 hover:text-blue">
          {job.contactPhone}
        </a>
      </div>

      {open && (
        <div className="mt-3 rounded-xl border border-black/12 p-3">
          {job.reviewMode === 'direct' && (
            <p className="mb-2 text-[13px] text-black/60">
              This customer chose direct to print — what you send here is final and completes the job.
            </p>
          )}
          <PhotoUpload
            kind="products"
            label="Proof"
            aspect="aspect-[4/3]"
            onChange={(url) => { if (url) run(() => submitProof(job.id, url, note)); }}
          />
          <Input className="mt-2" value={note} onChange={(e) => setNote(e.target.value)}
            placeholder="Note for the customer (optional)" />
        </div>
      )}

      {error && <p className="mt-2 text-sm text-red">{error}</p>}
    </li>
  );
}
