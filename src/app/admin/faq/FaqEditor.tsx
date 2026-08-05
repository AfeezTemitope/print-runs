'use client';

import { useState, useTransition } from 'react';
import { Eye, EyeOff, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Field, Input, Textarea } from '@/components/ui/Field';
import { saveFaq, deleteFaq, toggleFaq } from './actions';

export type FaqRow = {
  id: string;
  question: string;
  answer: string;
  sortOrder: number;
  isPublished: boolean;
};

function Row({ row, onDone }: { row: FaqRow | null; onDone: () => void }) {
  const [question, setQuestion] = useState(row?.question ?? '');
  const [answer, setAnswer] = useState(row?.answer ?? '');
  const [sortOrder, setSortOrder] = useState(String(row?.sortOrder ?? 0));
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function run(fn: () => Promise<{ error?: string } | void>) {
    setError(null);
    start(async () => {
      const res = await fn();
      if (res && 'error' in res && res.error) { setError(res.error); return; }
      setSaved(true);
      onDone();
    });
  }

  return (
    <li className="rounded-2xl border border-black/12 bg-white p-4">
      <div className="grid gap-3">
        <Field label="Question">
          <Input value={question} onChange={(e) => { setQuestion(e.target.value); setSaved(false); }}
            placeholder="How is delivery handled?" />
        </Field>
        <Field label="Answer">
          <Textarea rows={4} value={answer} onChange={(e) => { setAnswer(e.target.value); setSaved(false); }}
            placeholder="Plain language — this is customer-facing." />
        </Field>
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Order" hint="Lower numbers show first.">
            <Input inputMode="numeric" className="!w-24" value={sortOrder}
              onChange={(e) => { setSortOrder(e.target.value.replace(/[^\d-]/g, '')); setSaved(false); }} />
          </Field>
          <Button size="sm" disabled={pending} onClick={() => run(() => saveFaq({
            id: row?.id,
            question,
            answer,
            sortOrder: Number(sortOrder) || 0,
            isPublished: row?.isPublished ?? true,
          }))}>
            {pending ? 'Saving…' : saved ? 'Saved' : row ? 'Save' : 'Add question'}
          </Button>

          {row && (
            <>
              <Button size="sm" variant="tertiary" disabled={pending}
                onClick={() => run(() => toggleFaq(row.id, !row.isPublished))}>
                {row.isPublished ? <><EyeOff className="size-4" /> Unpublish</> : <><Eye className="size-4" /> Publish</>}
              </Button>
              <button
                aria-label="Delete question"
                className="ml-auto text-black/35 hover:text-red"
                onClick={() => run(() => deleteFaq(row.id))}
              >
                <Trash2 className="size-4" />
              </button>
            </>
          )}
        </div>
        {row && !row.isPublished && (
          <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-black/45">
            Hidden from customers
          </p>
        )}
        {error && <p className="text-sm text-red">{error}</p>}
      </div>
    </li>
  );
}

export function FaqEditor({ rows }: { rows: FaqRow[] }) {
  const [adding, setAdding] = useState(false);
  return (
    <>
      <div className="mt-6 flex justify-end">
        <Button size="sm" variant="tertiary" onClick={() => setAdding((a) => !a)}>
          <Plus className="size-4" /> {adding ? 'Cancel' : 'New question'}
        </Button>
      </div>
      <ul className="mt-3 space-y-3">
        {adding && <Row row={null} onDone={() => setAdding(false)} />}
        {rows.map((r) => <Row key={r.id} row={r} onDone={() => {}} />)}
      </ul>
      {!rows.length && !adding && (
        <p className="mt-6 text-black/55">No questions yet. Add the ones customers actually ask.</p>
      )}
    </>
  );
}
