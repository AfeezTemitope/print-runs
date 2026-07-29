import type { Metadata } from 'next';
import Link from 'next/link';
import { LIVE_CATEGORIES, productCode } from '@/lib/categories';
import { Glyph } from '@/components/ui/Glyph';
import { CodeBadge } from '@/components/ui/CodeBadge';

export const metadata: Metadata = {
  title: 'Products',
  description: 'Banners, jotters, flyers, business cards, stickers, branded nylon, thank you cards and ID cards — printed by Lagos printers near you.',
};

export default function ProductsPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 md:py-14">
      <h1 className="font-display text-4xl font-extrabold tracking-tight text-black sm:text-5xl">
        What are you <span className="text-blue">printing</span> today?
      </h1>
      <p className="mt-2 text-black/60">Pick a product, set your spec, then compare nearby printers.</p>

      {/* V2: only live categories are shown — Frame is locked and Paper Bag is unspecced,
          so neither appears to a customer at all (founder decisions). Categories with
          variants get a per-variant card so Sticker×3 and Business Card×2 are each
          discoverable from the landing grid (Batch 2). */}
      <ul className="mt-8 grid grid-cols-2 gap-3.5 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4">
        {LIVE_CATEGORIES.flatMap((c) =>
          (c.variants && c.variants.length > 1
            ? c.variants.map((v) => ({
                key: `${c.slug}-${v.slug}`,
                href: `/configure/${c.slug}?variant=${v.slug}`,
                title: `${c.name} — ${v.label}`,
                blurb: v.blurb,
                cat: c,
              }))
            : [{ key: c.slug, href: `/configure/${c.slug}`, title: c.name, blurb: c.blurb, cat: c }]),
        ).map((card) => {
          const c = card.cat;
          return (
          <li key={card.key}>
            {c.live ? (
              <Link
                href={card.href}
                className="group flex h-full flex-col gap-3 rounded-2xl border border-black/12 bg-white p-5 transition-all hover:-translate-y-0.5 hover:border-blue"
              >
                <div className="flex items-start justify-between">
                  <Glyph kind={c.glyph} color={c.hue} className="size-12" />
                  <CodeBadge code={productCode(c.slug)} tone="light" />
                </div>
                <div>
                  <h2 className="font-display text-lg font-extrabold tracking-tight text-navy">{card.title}</h2>
                  <p className="mt-0.5 text-[13px] text-black/55">{card.blurb}</p>
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
                  <h2 className="font-display text-lg font-extrabold tracking-tight text-navy/60">{card.title}</h2>
                  <p className="mt-0.5 font-mono text-[10px] font-bold uppercase tracking-widest text-navy/45">Coming soon</p>
                </div>
              </div>
            )}
          </li>
          );
        })}
      </ul>
    </div>
  );
}
