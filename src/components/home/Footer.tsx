import Link from 'next/link';
import { Logo } from '@/components/ui/Logo';
import { LEGAL_DOCS } from '@/lib/legal';

const COLS = [
  {
    h: 'Shop',
    links: [
      { label: 'Stickers', href: '/configure/sticker' },
      { label: 'Banners', href: '/configure/banner' },
      { label: 'Business Cards', href: '/configure/business_card' },
      // Frame is hidden from customers, so linking to it here produced a 404.
      { label: 'Jotters', href: '/configure/jotter' },
    ],
  },
  {
    h: 'Service',
    links: [
      { label: 'Track Order', href: '/track' },
      { label: 'FAQ', href: '/faq' },
      { label: 'Designers', href: '/designers' },
      { label: 'Hire a Designer', href: '/designers' },
      { label: 'All Products', href: '/products' },
      { label: 'My Orders', href: '/orders' },
      { label: 'Sell on Print Runs', href: '/register?as=printer' },
    ],
  },
  {
    h: 'Account',
    links: [
      { label: 'Login', href: '/login' },
      { label: 'Register', href: '/register' },
      { label: 'Printer Dashboard', href: '/dashboard' },
      { label: 'Designer Studio', href: '/studio' },
    ],
  },
  {
    h: 'Legal',
    links: LEGAL_DOCS.map((d) => ({ label: d.title, href: `/legal/${d.slug}` })),
  },
];

export function Footer() {
  return (
    <footer className="mt-16 bg-navy text-white">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="flex flex-col justify-between gap-6 border-b border-white/10 pb-9 sm:flex-row sm:items-end">
          <Logo size="lg" />
          <p className="max-w-xs text-white/65">Print without leaving home. Lagos-wide delivery and pickup.</p>
        </div>
        <div className="grid grid-cols-2 gap-8 py-9 sm:grid-cols-4">
          {COLS.map((c) => (
            <nav key={c.h} aria-label={c.h}>
              <h4 className="mb-3.5 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-pale">{c.h}</h4>
              {c.links.map((l) => (
                <Link key={l.label} href={l.href} className="block py-1.5 text-sm text-white/70 transition-colors hover:text-pale">
                  {l.label}
                </Link>
              ))}
            </nav>
          ))}
        </div>
        <div className="flex flex-wrap justify-between gap-2 border-t border-white/10 pt-5 font-mono text-[11px] text-white/45">
          <span>© {new Date().getFullYear()} Print Runs · Lagos, NG</span>
          <span>Made for makers</span>
        </div>
      </div>
    </footer>
  );
}
