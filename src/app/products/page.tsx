import type { Metadata } from 'next';
import Link from 'next/link';
import { LIVE_CATEGORIES, CATEGORIES } from '@/lib/categories';
import { getCatalogPhotos, pickPhoto } from '@/lib/photos';
import { Glyph } from '@/components/ui/Glyph';
import { ProductImage } from '@/components/ui/ProductImage';
import { CodeBadge } from '@/components/ui/CodeBadge';

export const metadata: Metadata = {
  title: 'Products',
  description: 'Banners, jotters, flyers, business cards, stickers, branded nylon, thank you cards and ID cards — printed by Lagos printers near you.',
};

export default async function ProductsPage({
  searchParams,
}: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const photos = await getCatalogPhotos();
  // An approved design travels with the customer from the grid all the way to the
  // configurator; dropping it here would silently make them re-upload the file.
  const raw = (await searchParams).design;
  const design = Array.isArray(raw) ? raw[0] : raw;
  const carry = design ? `?design=${encodeURIComponent(design)}` : '';
  // QA 1.1: ONE card per product. Categories with more than one type (Sticker, Jotter,
  // Business Card) no longer explode into a card each — the type choice happens on the
  // photo-led page behind the card, not here.
  const coming = CATEGORIES.filter((c) => !c.live);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 md:py-14">
      <h1 className="font-display text-4xl font-extrabold tracking-tight text-black sm:text-5xl">
        What are you <span className="text-blue">printing</span> today?
      </h1>
      <p className="mt-2 text-black/60">Pick a product, set your spec, then compare nearby printers.</p>
      {design && (
        <p className="mt-3 inline-block rounded-xl border border-blue/30 bg-blue/5 px-4 py-2.5 text-[13px] text-navy">
          Your approved design from <strong>{design}</strong> will be attached automatically.
        </p>
      )}

      <ul className="mt-8 grid grid-cols-2 gap-3.5 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4">
        {LIVE_CATEGORIES.map((c) => (
          <li key={c.slug}>
            <Link
              href={`/configure/${c.slug}${carry}`}
              className="group flex h-full flex-col overflow-hidden rounded-2xl border border-black/12 bg-white transition-all hover:-translate-y-0.5 hover:border-blue"
            >
              <div className="relative">
                <ProductImage
                  url={pickPhoto(photos, c.slug)}
                  glyph={c.glyph}
                  hue={c.hue}
                  alt={c.name}
                  className="aspect-[4/3] bg-pale/40"
                  glyphClassName="size-14"
                />
                <span className="absolute right-2.5 top-2.5"><CodeBadge code={c.code} tone="light" /></span>
              </div>
              <div className="flex flex-1 flex-col gap-3 p-5">
                <div>
                  <h2 className="font-display text-lg font-extrabold tracking-tight text-navy">{c.name}</h2>
                  <p className="mt-0.5 text-[13px] text-black/55">{c.blurb}</p>
                </div>
                <span className="mt-auto border-t border-dashed border-black/25 pt-2.5 font-display text-[13px] font-bold text-navy transition-colors group-hover:text-blue">
                  {c.listings.length > 1 ? 'Choose type' : 'Configure'} <span aria-hidden>→</span>
                </span>
              </div>
            </Link>
          </li>
        ))}

        {coming.map((c) => (
          <li key={c.slug}>
            <div className="flex h-full flex-col gap-3 rounded-2xl border border-dashed border-black/20 bg-white/60 p-5 opacity-70">
              <div className="flex items-start justify-between">
                <Glyph kind={c.glyph} color={c.hue} className="size-12 opacity-50" />
                <CodeBadge code={c.code} tone="light" />
              </div>
              <div>
                <h2 className="font-display text-lg font-extrabold tracking-tight text-navy/60">{c.name}</h2>
                <p className="mt-0.5 font-mono text-[10px] font-bold uppercase tracking-widest text-navy/45">Coming soon</p>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
