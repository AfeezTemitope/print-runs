import Link from 'next/link';

/** Slanted wordmark — the italic slant stays exclusive to the logo (spec §7.3). */
export function Logo({
  dark = false, size = 'md', href = '/', label = 'Print Runs — home',
}: { dark?: boolean; size?: 'md' | 'lg'; href?: string; label?: string }) {
  const text = size === 'lg' ? 'text-4xl' : 'text-[22px]';
  return (
    <Link
      href={href}
      className={`inline-flex items-baseline gap-1.5 font-display font-extrabold italic tracking-tight -skew-x-6 ${text}`}
      aria-label={label}
    >
      <span className={dark ? 'text-navy' : 'text-white'}>PRINT</span>
      <span className={dark ? 'text-blue' : 'text-pale'}>RUNS</span>
    </Link>
  );
}
