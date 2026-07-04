import type { ComponentProps, ReactNode } from 'react';

const inputCls =
  'w-full rounded-xl border border-black/20 bg-white px-3.5 py-2.5 font-mono text-sm ' +
  'focus:border-blue focus:outline-none focus:ring-2 focus:ring-blue/20 placeholder:text-black/30';

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block font-display text-[13px] font-bold text-navy">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-black/45">{hint}</span>}
    </label>
  );
}

export function Input(props: ComponentProps<'input'>) {
  return <input {...props} className={`${inputCls} ${props.className ?? ''}`} />;
}
export function Select(props: ComponentProps<'select'>) {
  return <select {...props} className={`${inputCls} ${props.className ?? ''}`} />;
}
export function Textarea(props: ComponentProps<'textarea'>) {
  return <textarea {...props} className={`${inputCls} ${props.className ?? ''}`} />;
}
