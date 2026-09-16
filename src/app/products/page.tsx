import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { BROWSABLE_CATEGORIES } from '@/lib/catalog';
import { categoriesWithStock } from '@/lib/discovery';
import { getCatalogPhotos, pickPhoto } from '@/lib/photos';
import { ProductImage } from '@/components/ui/ProductImage';
import { SearchBar } from '@/components/discovery/SearchBar';
import type { GlyphKind } from '@/components/ui/Glyph';

export const metadata: Metadata = {
  title: 'Products',
  description: 'Banners, stickers, cards, flyers, packaging and more — printed by Lagos printers near you.',
};

/** Path A (§3.2): category tiles plus a search bar, both routing to the printer results list. */
export default async function ProductsPage({
  searchParams,
}: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  // An approved design carries through from the Designer Marketplace.
  const design = one(sp.design);
  const carry = design ? `&design=${encodeURIComponent(design)}` : '';

  const [photos, stocked] = await Promise.all([getCatalogPhotos(), categoriesWithStock()]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 md:py-14">
      <h1 className="font-display text-4xl font-extrabold tracking-tight text-black sm:text-5xl">
        What are you <span className="text-blue">printing</span> today?
      </h1>
      <p className="mt-2 text-black/60">Pick a category and we&apos;ll show you printers near you who do it.</p>

      {design && (
        <p className="mt-3 inline-block rounded-xl border border-blue/30 bg-blue/5 px-4 py-2.5 text-[13px] text-navy">
          Your approved design from <strong>{design}</strong> will be attached automatically.
        </p>
      )}

      <div className="mt-6 max-w-xl">
        <Suspense fallback={<div className="h-12 rounded-pill bg-black/5" />}>
          <SearchBar action="/printers" placeholder="Search stickers, banners, flyers…" />
        </Suspense>
      </div>

      <ul className="mt-8 grid grid-cols-2 gap-3.5 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4">
        {BROWSABLE_CATEGORIES.map((c) => {
          const soon = c.status !== 'live';
          const empty = !soon && !stocked.has(c.slug);

          const inner = (
            <>
              <div className="relative">
                <ProductImage
                  url={pickPhoto(photos, c.slug)}
                  glyph={c.glyph as GlyphKind}
                  hue={c.hue}
                  alt={c.name}
                  className="aspect-[4/3] bg-pale/40"
                  glyphClassName="size-14"
                />
                {soon && (
                  <span className="absolute right-2.5 top-2.5 rounded-pill bg-navy px-2.5 py-1 font-mono text-[9px] font-bold uppercase tracking-widest text-pale">
                    Coming soon
                  </span>
                )}
              </div>
              <div className="flex flex-1 flex-col gap-3 p-5">
                <div>
                  <h2 className="font-display text-lg font-extrabold tracking-tight text-navy">{c.name}</h2>
                  <p className="mt-0.5 text-[13px] text-black/55">{c.blurb}</p>
                </div>
                <span className="mt-auto border-t border-dashed border-black/25 pt-2.5 font-display text-[13px] font-bold text-navy">
                  {soon ? 'Not yet available' : empty ? 'No printers yet' : <>Find printers <span aria-hidden>→</span></>}
                </span>
              </div>
            </>
          );

          // Coming Soon and empty categories stay visible but are not tappable — landing on an
          // empty results list is a worse experience than seeing the category is not ready.
          return (
            <li key={c.slug}>
              {soon || empty ? (
                <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-dashed border-black/20 bg-white/60 opacity-70">
                  {inner}
                </div>
              ) : (
                <Link href={`/printers?category=${c.slug}${carry}`}
                  className="group flex h-full flex-col overflow-hidden rounded-2xl border border-black/12 bg-white transition-all hover:-translate-y-0.5 hover:border-blue">
                  {inner}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
