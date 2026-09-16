'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { Search } from 'lucide-react';

/** Submits as a URL change so results stay shareable and refresh-safe. */
export function SearchBar({ action, placeholder }: { action: string; placeholder: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get('q') ?? '');

  function submit() {
    const next = new URLSearchParams(params.toString());
    if (q.trim()) next.set('q', q.trim()); else next.delete('q');
    router.push(`${action}?${next.toString()}`);
  }

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-black/35" />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-12 w-full rounded-pill border border-black/15 bg-white pl-11 pr-24 text-[15px] outline-none transition-colors focus:border-blue"
      />
      <button onClick={submit}
        className="absolute right-1.5 top-1.5 rounded-pill bg-navy px-4 py-2 font-display text-[13px] font-bold text-white">
        Search
      </button>
    </div>
  );
}
