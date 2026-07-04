/** Mono code badge — PR-001 on products, LB-014 on vendors (spec §7.4). */
export function CodeBadge({ code, tone = 'dark' }: { code: string; tone?: 'dark' | 'light' }) {
  const cls = tone === 'dark' ? 'bg-navy text-white' : 'bg-white text-navy border border-black/15';
  return (
    <span className={`inline-block rounded-pill px-2.5 py-1 font-mono text-[10px] font-bold tracking-widest ${cls}`}>
      {code}
    </span>
  );
}
