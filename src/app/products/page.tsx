import type { Metadata } from 'next';
import Link from 'next/link';
import { CATEGORIES, productCode } from '@/lib/categories';
import { Glyph } from '@/components/ui/Glyph';
import { CodeBadge } from '@/components/ui/CodeBadge';

export const metadata: Metadata = {
  title: 'Products',
  description: 'Stickers, banners, flyers, business cards, jotters, frames and more — printed by Lagos printers near you.',
};

export default function ProductsPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 md:py-14">
      <h1 className="font-display text-4xl font-extrabold tracking-tight text-black sm:text-5xl">
        What are you <span className="text-blue">printing</span> today?
      </h1>
      <p className="mt-2 text-black/60">Pick a product, set your spec, then compare nearby printers.</p>

      <ul className="mt-8 grid grid-cols-2 gap-3.5 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4">
        {CATEGORIES.map((c) => (
          <li key={c.slug}>
            {c.live ? (
              <Link
                href={`/configure/${c.slug}`}
                className="group flex h-full flex-col gap-3 rounded-2xl border border-black/12 bg-white p-5 transition-all hover:-translate-y-0.5 hover:border-blue"
              >
                <div className="flex items-start justify-between">
                  <Glyph kind={c.glyph} color={c.hue} className="size-12" />
                  <CodeBadge code={productCode(c.slug)} tone="light" />
                </div>
                <div>
                  <h2 className="font-display text-lg font-extrabold tracking-tight text-navy">{c.name}</h2>
                  <p className="mt-0.5 text-[13px] text-black/55">{c.blurb}</p>
                </div>
                <span className="mt-auto border-t border-dashed border-black/25 pt-2.5 font-display text-[13px] font-bold text-navy transition-colors group-hover:text-blue">
                  Configure <span aria-hidden>→</span>
                </span>
              </Link>
            ) : (
              <div className="flex h-full flex-col gap-3 rounded-2xl border border-dashed border-black/20 bg-white/60 p-5 opacity-70">
                <div className="flex items-start justify-between">
                  <Glyph kind={c.glyph} color={c.hue} className="size-12 opacity-50" />
                  <CodeBadge code={productCode(c.slug)} tone="light" />
                </div>
                <div>
                  <h2 className="font-display text-lg font-extrabold tracking-tight text-navy/60">{c.name}</h2>
                  <p className="mt-0.5 font-mono text-[10px] font-bold uppercase tracking-widest text-navy/45">Coming soon</p>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
