import { Check } from 'lucide-react';

/**
 * Horizontal step tracker (spec §3 screen 7):
 * Placed → Printing → Ready → Picked up / Delivered.
 * Reads the same status field the printer's queue buttons write — one source of truth.
 */
const STEPS = ['placed', 'printing', 'ready', 'completed'] as const;

export function StatusTracker({
  status, method,
}: { status: string; method: 'delivery' | 'pickup' }) {
  const labels = ['Placed', 'Printing', 'Ready', method === 'pickup' ? 'Picked up' : 'Delivered'];
  const idx = status === 'cancelled' ? -1 : STEPS.indexOf(status as (typeof STEPS)[number]);

  if (status === 'cancelled') {
    return <p className="font-mono text-xs font-bold uppercase tracking-widest text-red">Cancelled</p>;
  }

  return (
    <ol className="flex items-center" aria-label="Order progress">
      {labels.map((label, i) => {
        const done = i < idx;
        const current = i === idx;
        return (
          <li key={label} className="flex flex-1 items-center last:flex-none">
            <div className="flex flex-col items-center gap-1.5">
              <span
                className={`grid size-7 place-items-center rounded-full border text-[11px] font-bold ${
                  done ? 'border-blue bg-blue text-white'
                  : current ? 'border-blue bg-white text-blue'
                  : 'border-black/20 bg-white text-black/30'
                }`}
              >
                {done ? <Check className="size-3.5" strokeWidth={3} /> : i + 1}
              </span>
              <span className={`whitespace-nowrap text-[11px] font-semibold ${current ? 'text-blue' : done ? 'text-navy' : 'text-black/35'}`}>
                {label}
              </span>
            </div>
            {i < labels.length - 1 && (
              <span className={`mx-2 mb-5 h-px flex-1 ${i < idx ? 'bg-blue' : 'bg-black/15'}`} aria-hidden />
            )}
          </li>
        );
      })}
    </ol>
  );
}
