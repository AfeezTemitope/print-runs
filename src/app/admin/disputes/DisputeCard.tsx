'use client';

import { useState, useTransition } from 'react';
import { AlertTriangle } from 'lucide-react';
import { naira, shortDate } from '@/lib/format';
import { Button } from '@/components/ui/Button';
import { Select, Textarea } from '@/components/ui/Field';
import { CodeBadge } from '@/components/ui/CodeBadge';
import { decideDispute } from './actions';

export type DisputeItem = {
  id: string; orderCode: string; createdAt: string;
  reasonLabel: string; detail: string | null; evidenceUrls: string[];
  printerName: string; printerResponse: string | null; printerRespondedAt: string | null;
  state: string; outcome: string | null; decisionNote: string | null;
  preflightOverridden: boolean; amountPaidKobo: number;
  standing: string; hoursForResponse: number;
};

export function DisputeCard({ item }: { item: DisputeItem }) {
  const [decision, setDecision] = useState<'customer' | 'printer'>('customer');
  const [outcome, setOutcome] = useState<'reprint' | 'refund' | 'none'>('reprint');
  const [note, setNote] = useState('');
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const decided = Boolean(item.outcome);

  return (
    <li className={`rounded-2xl border bg-white p-4 ${decided ? 'border-black/12' : 'border-red'}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <CodeBadge code={item.orderCode} tone="light" />
            <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-black/45">
              {shortDate(item.createdAt)}
            </span>
          </div>
          <p className="mt-1 font-display font-extrabold text-navy">{item.reasonLabel}</p>
          <p className="mt-0.5 text-[13px] text-black/55">
            {item.printerName} · {naira(item.amountPaidKobo)} paid
          </p>
        </div>
        {decided && (
          <span className={`font-mono text-[10px] font-bold uppercase tracking-widest ${
            item.state === 'resolved_customer' ? 'text-red' : 'text-success'
          }`}>
            {item.state === 'resolved_customer' ? `customer · ${item.outcome}` : 'printer'}
          </span>
        )}
      </div>

      {item.detail && <p className="mt-2.5 rounded-xl bg-pale/30 px-4 py-2.5 text-[14px] text-black/75">{item.detail}</p>}

      {item.evidenceUrls.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-2">
          {item.evidenceUrls.map((u, i) => (
            <li key={u}>
              <a href={u} target="_blank" rel="noreferrer"
                className="rounded-pill border border-black/20 px-3 py-1.5 font-display text-[12px] font-bold text-navy hover:border-blue">
                Evidence {i + 1}
              </a>
            </li>
          ))}
        </ul>
      )}

      {item.preflightOverridden && (
        <p className="mt-2.5 flex items-start gap-2 rounded-xl border border-red/30 bg-red/5 px-3.5 py-2.5 text-[13px] text-navy">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-red" />
          <span>
            The customer <strong>overrode a failed preflight check</strong> on this order. For a
            quality complaint, that is strong evidence in the printer&apos;s favour — they were
            warned and accepted responsibility.
          </span>
        </p>
      )}

      <div className="mt-2.5 rounded-xl border border-black/12 px-4 py-2.5">
        <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-black/45">
          {item.printerName}&apos;s response
        </p>
        <p className="mt-1 text-[14px] text-black/70">
          {item.printerResponse ?? `Not yet — they have ${item.hoursForResponse} hours to reply.`}
        </p>
      </div>

      {item.standing && <p className="mt-2 text-xs text-black/50">{item.standing}</p>}

      {decided ? (
        item.decisionNote && <p className="mt-2.5 text-[13px] text-black/60">{item.decisionNote}</p>
      ) : (
        <div className="mt-3 border-t border-dashed border-black/20 pt-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <Select value={decision} onChange={(e) => setDecision(e.target.value as 'customer' | 'printer')} aria-label="Decision">
              <option value="customer">In the customer&apos;s favour</option>
              <option value="printer">In the printer&apos;s favour</option>
            </Select>
            <Select value={outcome} onChange={(e) => setOutcome(e.target.value as typeof outcome)} aria-label="Outcome">
              <option value="reprint">Reprint</option>
              <option value="refund">Refund</option>
              <option value="none">No remedy</option>
            </Select>
          </div>
          <Textarea rows={2} className="mt-2" value={note} onChange={(e) => setNote(e.target.value)}
            placeholder="Why — both sides see this decision." />
          <Button size="sm" className="mt-2" disabled={pending} onClick={() => {
            setError(null);
            start(async () => {
              const res = await decideDispute(item.id, decision, outcome, note);
              if (res?.error) setError(res.error);
            });
          }}>
            {pending ? 'Recording…' : 'Record decision'}
          </Button>
          <p className="mt-1.5 text-xs text-black/50">
            In the customer&apos;s favour, settlement stays frozen — arrange the reprint or refund
            separately. In the printer&apos;s favour, it&apos;s released.
          </p>
        </div>
      )}

      {error && <p className="mt-2 text-sm text-red">{error}</p>}
    </li>
  );
}
