'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useState, useRef, useEffect } from 'react';
import { CircleUserRound } from 'lucide-react';

export function AccountMenu({ role }: { role: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/');
    router.refresh();
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="grid size-10 place-items-center rounded-full border border-white/30 transition-colors hover:bg-white/10"
        aria-label="Account menu"
        aria-expanded={open}
      >
        <CircleUserRound className="size-5" />
      </button>
      {open && (
        <div className="absolute right-0 top-12 w-48 overflow-hidden rounded-2xl border border-black/10 bg-white text-navy shadow-lg">
          {(role === 'printer' || role === 'admin') && (
            <Link href="/dashboard" onClick={() => setOpen(false)} className="block px-4 py-3 font-display text-sm font-bold hover:bg-pale/60">
              Printer dashboard
            </Link>
          )}
          <Link href="/orders" onClick={() => setOpen(false)} className="block px-4 py-3 font-display text-sm font-bold hover:bg-pale/60">
            My orders
          </Link>
          <Link href="/track" onClick={() => setOpen(false)} className="block px-4 py-3 font-display text-sm font-bold hover:bg-pale/60">
            Track order
          </Link>
          <button onClick={logout} className="block w-full px-4 py-3 text-left font-display text-sm font-bold text-red hover:bg-pale/60">
            Log out
          </button>
        </div>
      )}
    </div>
  );
}
