'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, ListOrdered, Package, ReceiptText, Wallet, Star, Settings, BadgeCheck, Store, MessageSquare,
} from 'lucide-react';

const LINKS = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard, exact: true },
  { href: '/dashboard/queue', label: 'Job queue', icon: ListOrdered },
  { href: '/dashboard/listings', label: 'Products', icon: Package },
  { href: '/dashboard/quotes', label: 'Quotes', icon: MessageSquare },
  { href: '/dashboard/storefront', label: 'Storefront', icon: Store },
  { href: '/dashboard/verification', label: 'Verification', icon: BadgeCheck },
  { href: '/dashboard/orders', label: 'Orders', icon: ReceiptText },
  { href: '/dashboard/earnings', label: 'Earnings', icon: Wallet },
  { href: '/dashboard/reviews', label: 'Reviews', icon: Star },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings },
];

const MOBILE = LINKS.slice(0, 5); // Overview · Queue · Products · Orders · Earnings

export function DashboardNav({ variant }: { variant: 'side' | 'bottom' }) {
  const pathname = usePathname();
  const isActive = (href: string, exact?: boolean) => (exact ? pathname === href : pathname.startsWith(href));

  if (variant === 'side') {
    return (
      <nav className="space-y-1" aria-label="Dashboard">
        {LINKS.map(({ href, label, icon: Icon, exact }) => (
          <Link
            key={href}
            href={href}
            aria-current={isActive(href, exact) ? 'page' : undefined}
            className={`flex items-center gap-2.5 rounded-pill px-4 py-2.5 font-display text-sm font-bold transition-colors ${
              isActive(href, exact) ? 'bg-blue text-white' : 'text-navy hover:bg-black/5'
            }`}
          >
            <Icon className="size-4" /> {label}
          </Link>
        ))}
      </nav>
    );
  }

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 border-t border-black/10 bg-white/95 backdrop-blur md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="Dashboard navigation"
    >
      <ul className="mx-auto grid max-w-md grid-cols-5">
        {MOBILE.map(({ href, label, icon: Icon, exact }) => {
          const active = isActive(href, exact);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={`flex min-h-16 flex-col items-center justify-center gap-1 ${active ? 'text-blue' : 'text-navy/50'}`}
              >
                <Icon className="size-[22px]" strokeWidth={active ? 2.4 : 2} />
                <span className="text-[10px] font-bold">{label.split(' ')[0]}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
