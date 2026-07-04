'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, LayoutGrid, PackageSearch, ReceiptText, CircleUserRound } from 'lucide-react';

/**
 * Mobile app navigation — fixed bottom tab bar, no hamburger.
 * Hidden on md+ (desktop keeps the top nav) and inside /dashboard,
 * which has its own tab set.
 */
const TABS = [
  { href: '/', label: 'Home', icon: Home, exact: true },
  { href: '/products', label: 'Products', icon: LayoutGrid },
  { href: '/track', label: 'Track', icon: PackageSearch },
  { href: '/orders', label: 'Orders', icon: ReceiptText },
  { href: '/login', label: 'Account', icon: CircleUserRound },
];

export function BottomNav() {
  const pathname = usePathname();
  if (pathname.startsWith('/dashboard')) return null;

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 border-t border-black/10 bg-white/95 backdrop-blur md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="App navigation"
    >
      <ul className="mx-auto grid max-w-md grid-cols-5">
        {TABS.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                className={`flex min-h-16 flex-col items-center justify-center gap-1 ${active ? 'text-blue' : 'text-navy/50'}`}
                aria-current={active ? 'page' : undefined}
              >
                <Icon className="size-[22px]" strokeWidth={active ? 2.4 : 2} />
                <span className="text-[10px] font-bold">{label}</span>
                <span className={`h-1 w-1 rounded-full ${active ? 'bg-blue' : 'bg-transparent'}`} aria-hidden />
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
