import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';

/**
 * Spec §7.2 button hierarchy, applied everywhere (§7.4):
 *  primary   — filled navy, white text, pill
 *  secondary — filled pale yellow, black text, thin black border, pill
 *  tertiary  — white, black border, pill
 */
type Variant = 'primary' | 'secondary' | 'tertiary' | 'danger-ghost';
type Size = 'md' | 'sm';

const styles: Record<Variant, string> = {
  primary: 'bg-navy text-white border border-navy hover:bg-blue hover:border-blue',
  secondary: 'bg-pale text-black border border-black hover:bg-[#fff7a0]',
  tertiary: 'bg-white text-black border border-black hover:bg-black/5',
  'danger-ghost': 'bg-white text-red border border-red/40 hover:border-red',
};
const sizes: Record<Size, string> = {
  md: 'px-6 py-3 text-[15px]',
  sm: 'px-4 py-2 text-[13px]',
};

const base =
  'inline-flex items-center justify-center gap-2 rounded-pill font-display font-bold tracking-tight ' +
  'transition-colors disabled:opacity-40 disabled:cursor-not-allowed select-none';

export function Button({
  variant = 'primary', size = 'md', className = '', ...props
}: ComponentProps<'button'> & { variant?: Variant; size?: Size }) {
  return <button className={`${base} ${styles[variant]} ${sizes[size]} ${className}`} {...props} />;
}

export function ButtonLink({
  variant = 'primary', size = 'md', className = '', href, children, ...props
}: ComponentProps<typeof Link> & { variant?: Variant; size?: Size; children: ReactNode }) {
  return (
    <Link href={href} className={`${base} ${styles[variant]} ${sizes[size]} ${className}`} {...props}>
      {children}
    </Link>
  );
}
