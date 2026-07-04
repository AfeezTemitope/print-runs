import Link from 'next/link';
import { Logo } from '@/components/ui/Logo';
import { ButtonLink } from '@/components/ui/Button';
import { getSession } from '@/lib/auth';
import { AccountMenu } from './AccountMenu';

/**
 * Navbar gradient: pure blue → near-black navy, left to right (spec §7.2).
 * On mobile it slims down to logo + account; the bottom tab bar carries navigation.
 */
export async function TopNav() {
  const session = await getSession();
  return (
    <header className="sticky top-0 z-50 bg-nav-gradient text-white">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Logo />
        <nav className="hidden items-center gap-7 font-display text-[15px] font-semibold md:flex" aria-label="Main">
          <Link href="/" className="opacity-90 transition-opacity hover:opacity-100">Home</Link>
          <Link href="/products" className="opacity-90 transition-opacity hover:opacity-100">Products</Link>
          <Link href="/track" className="opacity-90 transition-opacity hover:opacity-100">Track Order</Link>
          <Link href="/orders" className="opacity-90 transition-opacity hover:opacity-100">My Orders</Link>
        </nav>
        <div className="flex items-center gap-2.5">
          {session ? (
            <AccountMenu role={session.role} />
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
