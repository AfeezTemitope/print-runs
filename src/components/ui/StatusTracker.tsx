import { Check } from 'lucide-react';
import type { OrderStatus, FulfillmentMethod } from '@/lib/status';
import { stepsFor, statusLabel } from '@/lib/status';

/**
 * V2 tracker — 7 stages (decision 18), driven by the same status field the printer's queue
 * writes. Collection orders show a 6-step path: there's no "out for delivery" stage when the
 * customer's own rider is doing the collecting.
 *
 * Compact on mobile (dots + the current label only) since 7 labels won't fit a phone width.
 */
export function StatusTracker({
  status, method,
}: { status: OrderStatus; method: FulfillmentMethod }) {
  if (status === 'cancelled') {
    return <p className="font-mono text-xs font-bold uppercase tracking-widest text-red">Cancelled</p>;
  }

  const steps = stepsFor(method);
  const idx = steps.indexOf(status);

  return (
    <div>
      <ol className="flex items-center" aria-label="Order progress">
        {steps.map((step, i) => {
          const done = i < idx;
          const current = i === idx;
          return (
            <li key={step} className="flex flex-1 items-center last:flex-none">
              <div className="flex flex-col items-center gap-1.5">
                <span
                  className={`grid size-7 shrink-0 place-items-center rounded-full border text-[11px] font-bold ${
                    done ? 'border-blue bg-blue text-white'
                    : current ? 'border-blue bg-white text-blue'
                    : 'border-black/20 bg-white text-black/30'
                  }`}
                >
                  {done ? <Check className="size-3.5" strokeWidth={3} /> : i + 1}
                </span>
                {/* Labels are hidden on small screens — 7 of them won't fit a phone. */}
                <span
                  className={`hidden whitespace-nowrap text-[11px] font-semibold sm:block ${
                    current ? 'text-blue' : done ? 'text-navy' : 'text-black/35'
                  }`}
                >
                  {statusLabel(step, method)}
                </span>
              </div>
              {i < steps.length - 1 && (
                <span className={`mx-1.5 h-px flex-1 sm:mb-5 ${i < idx ? 'bg-blue' : 'bg-black/15'}`} aria-hidden />
              )}
            </li>
          );
        })}
      </ol>
      {/* Mobile fallback: one clear line instead of seven cramped ones. */}
      <p className="mt-2 text-center font-display text-sm font-bold text-blue sm:hidden">
        {statusLabel(status, method)}
      </p>
    </div>
  );
}
