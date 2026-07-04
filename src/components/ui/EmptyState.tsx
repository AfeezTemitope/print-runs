import type { ReactNode } from 'react';

export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-black/20 px-6 py-14 text-center">
      <p className="font-display text-lg font-bold text-navy">{title}</p>
      {hint && <p className="mt-1 text-sm text-black/60">{hint}</p>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}
