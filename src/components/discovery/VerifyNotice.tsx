'use client';

import { useEffect, useState } from 'react';
import { BadgeCheck, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';

const KEY = 'printruns.verify-notice.seen';

/**
 * One-time Marketplace notice (brief item #6).
 *
 * Shown once per SESSION, not once per page load and not once ever — sessionStorage, so it
 * returns on a new visit but never nags during one. A customer who dismissed it two clicks ago
 * does not need telling again; a customer coming back next week does.
 *
 * Deliberately not blocking: it can be dismissed with Escape, the backdrop or the button,
 * because a modal a customer cannot escape on a phone is worse than no warning at all.
 */
export function VerifyNotice() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(KEY)) return;
      setOpen(true);
    } catch {
      // Private browsing can throw on storage access. Showing nothing is the safe failure.
    }
  }, []);

  function dismiss() {
    setOpen(false);
    try { sessionStorage.setItem(KEY, '1'); } catch { /* nothing to do */ }
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') dismiss(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="verify-notice-title"
      onClick={dismiss}
    >
      <div className="relative w-full max-w-md rounded-2xl bg-white p-6" onClick={(e) => e.stopPropagation()}>
        <button onClick={dismiss} aria-label="Close"
          className="absolute right-4 top-4 text-black/35 hover:text-navy">
          <X className="size-5" />
        </button>

        <span className="inline-flex items-center gap-1.5 rounded-pill bg-success/10 px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-widest text-success">
          <BadgeCheck className="size-3.5" /> Verified
        </span>

        <h2 id="verify-notice-title" className="mt-3 font-display text-xl font-extrabold tracking-tight text-navy">
          Before you pay, check for the badge
        </h2>

        <p className="mt-2 text-[15px] leading-relaxed text-black/70">
          Before making payment, please confirm your chosen printer has a Verified badge.
          PrintRuns only guarantees order protection for verified vendors.
        </p>

        <Button className="mt-5 w-full" onClick={dismiss}>Got it</Button>
      </div>
    </div>
  );
}
