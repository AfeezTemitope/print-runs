import type { Metadata } from 'next';
import { Suspense } from 'react';
import { findPrinters } from '@/lib/discovery';
import { SearchBar } from '@/components/discovery/SearchBar';
import { PrinterCard } from '@/components/discovery/PrinterCard';
import { EmptyState } from '@/components/ui/EmptyState';

export const metadata: Metadata = {
  title: 'Marketplace',
  description: 'Discover Lagos printing businesses. Browse their work, compare prices and order online.',
};

/** Path B (§4): browse every printer. No product intent yet, so cards open the full storefront. */
export default async function MarketplacePage({
  searchParams,
}: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const search = one(sp.q);

  const printers = await findPrinters({ search });

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 md:py-14">
      <h1 className="font-display text-4xl font-extrabold tracking-tight text-black sm:text-5xl">
        Discover Lagos <span className="text-blue">printers</span>
      </h1>
      <p className="mt-2 max-w-2xl text-black/60">
        Browse printing businesses near you, see their actual work, and order without a single
        &ldquo;how much?&rdquo; message.
      </p>

      <div className="mt-6 max-w-xl">
        <Suspense fallback={<div className="h-12 rounded-pill bg-black/5" />}>
          <SearchBar action="/marketplace" placeholder="Search printer name or area…" />
        </Suspense>
      </div>

      {!printers.length ? (
        <div className="mt-8">
          <EmptyState
            title={search ? `No printers match “${search}”` : 'No printers yet'}
            hint={search ? 'Try an area like Lekki or Yaba.' : 'The first storefronts are being set up now.'}
          />
        </div>
      ) : (
        <>
          <p className="mt-6 font-mono text-[11px] font-bold uppercase tracking-widest text-black/45">
            {printers.length} printer{printers.length === 1 ? '' : 's'} · sorted by distance
          </p>
          <ul className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {printers.map((p) => (
              <li key={p.id}><PrinterCard card={p} href={`/${p.slug}`} /></li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
