import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAdmin } from '@/lib/admin';

export const metadata: Metadata = { title: { default: 'Admin', template: '%s · PrintRuns Admin' } };

const NAV = [
  { href: '/admin', label: 'Overview' },
  { href: '/admin/orders', label: 'Orders' },
  { href: '/admin/preflight', label: 'Preflight' },
  { href: '/admin/verification', label: 'Verification' },
  { href: '/admin/designers', label: 'Designers' },
  { href: '/admin/design-orders', label: 'Design orders' },
  { href: '/admin/margins', label: 'Margins' },
  { href: '/admin/photos', label: 'Photos' },
  { href: '/admin/faq', label: 'FAQ' },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-wrap items-center gap-3 border-b border-dashed border-black/20 pb-4">
        <span className="rounded-pill bg-navy px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-widest text-pale">
          Admin
        </span>
        <nav className="flex gap-1.5">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="rounded-pill px-3.5 py-1.5 font-display text-[13px] font-bold text-navy hover:bg-black/5"
            >
              {n.label}
            </Link>
          ))}
        </nav>
      </div>
      {children}
    </div>
  );
}
