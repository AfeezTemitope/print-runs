import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { getCategory, LIVE_CATEGORIES } from '@/lib/catalog';
import { findPrinters } from '@/lib/discovery';
import { SearchBar } from '@/components/discovery/SearchBar';
import { PrinterCard } from '@/components/discovery/PrinterCard';
import { EmptyState } from '@/components/ui/EmptyState';

export const metadata: Metadata = { title: 'Printers near you' };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/**
 * Path A results (§3.3): every printer with at least one active listing in this category,
 * sorted by distance. No filters at launch — the roster is too small to need narrowing, and
 * an empty filtered list reads as a broken site rather than a short one.
 *
 * Tapping a card deep-links into that printer's listings for this category (§3.4) rather than
 * their full storefront, because the customer has already said what they want to print.
 */
export default async function PrintersPage({
  searchParams,
}: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const categorySlug = one(sp.category);
  const search = one(sp.q);
  const design = one(sp.design);

  const category = getCategory(categorySlug);

  // A typed search may name a category rather than a printer — "stickers" should behave like
  // tapping the Stickers tile, not return nothing.
  const matchedByName = !category && search
    ? LIVE_CATEGORIES.find((c) =>
        c.name.toLowerCase().includes(search.toLowerCase())
        || c.suggested.some((s) => s.toLowerCase().includes(search.toLowerCase())))
    : undefined;

  const effective = category ?? matchedByName;
  const printers = await findPrinters({
    categorySlug: effective?.slug,
    // Once a category is resolved the free text has done its job; keeping it would also
    // filter by business name and hide most of the results.
    search: effective ? undefined : search,
  });

  const carry = design ? `&design=${encodeURIComponent(design)}` : '';

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <Link href="/products" className="font-display text-[13px] font-bold text-black/45 hover:text-blue">
        ← All products
      </Link>

      <h1 className="mt-2 font-display text-4xl font-extrabold tracking-tight text-black">
        {effective ? <>Printers offering <span className="text-blue">{effective.name}</span></> : 'Printers near you'}
      </h1>
      {effective && <p className="mt-2 text-black/60">{effective.blurb}</p>}

      <div className="mt-6 max-w-xl">
        <Suspense fallback={<div className="h-12 rounded-pill bg-black/5" />}>
          <SearchBar action="/printers" placeholder="Search a product or printer…" />
        </Suspense>
      </div>

      {!printers.length ? (
        <div className="mt-8">
          <EmptyState
            title={effective ? `No printers for ${effective.name} yet` : 'Nothing matched that'}
            hint="Try another category, or browse every printer in the Marketplace."
          />
          <p className="mt-4 text-center">
            <Link href="/marketplace" className="font-display text-sm font-bold text-blue underline">
              Browse the Marketplace →
            </Link>
          </p>
        </div>
      ) : (
        <>
          <p className="mt-6 font-mono text-[11px] font-bold uppercase tracking-widest text-black/45">
            {printers.length} printer{printers.length === 1 ? '' : 's'} · sorted by distance
          </p>
          <ul className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {printers.map((p) => (
              <li key={p.id}>
                <PrinterCard
                  card={p}
                  href={effective ? `/${p.slug}?category=${effective.slug}${carry}` : `/${p.slug}`}
                />
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
