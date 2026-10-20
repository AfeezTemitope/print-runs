import Link from 'next/link';
import { Logo } from '@/components/ui/Logo';
import { ButtonLink } from '@/components/ui/Button';
import { getSession } from '@/lib/auth';
import { homeForRole, homeLabelForRole } from '@/lib/home-for-role';
import { unreadCount } from '@/lib/inbox';
import { Bell } from 'lucide-react';
import { AccountMenu } from './AccountMenu';

/**
 * Navbar gradient: pure blue → near-black navy, left to right (spec §7.2).
 * On mobile it slims down to logo + account; the bottom tab bar carries navigation.
 */
export async function TopNav() {
  const session = await getSession();
  // Item #11: the logo and Home follow the signed-in role, so a printer is never dropped into
  // the customer view and left wondering whether their session expired.
  const home = homeForRole(session?.role);
  const unread = session ? await unreadCount(session.uid) : 0;
  return (
    <header className="sticky top-0 z-50 bg-nav-gradient text-white">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Logo href={home} label={homeLabelForRole(session?.role)} />
        <nav className="hidden items-center gap-7 font-display text-[15px] font-semibold md:flex" aria-label="Main">
          <Link href={home} className="opacity-90 transition-opacity hover:opacity-100">Home</Link>
          <Link href="/products" className="opacity-90 transition-opacity hover:opacity-100">Products</Link>
          <Link href="/track" className="opacity-90 transition-opacity hover:opacity-100">Track Order</Link>
          <Link href="/orders" className="opacity-90 transition-opacity hover:opacity-100">My Orders</Link>
        </nav>
        <div className="flex items-center gap-2.5">
          {session ? (
            <>
              {/* The in-app channel of the notification interface. Server-rendered, so the
                  count is right on every page load with no client polling. */}
              <Link href="/notifications" aria-label={unread ? `${unread} unread notifications` : 'Notifications'}
                className="relative grid size-9 place-items-center rounded-pill opacity-90 transition-opacity hover:bg-white/10 hover:opacity-100">
                <Bell className="size-5" />
                {unread > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 grid min-w-[18px] place-items-center rounded-pill bg-pale px-1 font-mono text-[10px] font-bold leading-[18px] text-navy">
                    {unread > 99 ? '99+' : unread}
                  </span>
                )}
              </Link>
              <AccountMenu role={session.role} />
            </>
          ) : (
            <>
              <ButtonLink href="/login" variant="secondary" size="sm">Login</ButtonLink>
              <ButtonLink href="/register" variant="tertiary" size="sm" className="hidden sm:inline-flex">Register</ButtonLink>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
