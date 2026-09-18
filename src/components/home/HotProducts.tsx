import Link from 'next/link';
import { BROWSABLE_CATEGORIES } from '@/lib/catalog';
import { Glyph } from '@/components/ui/Glyph';
import type { GlyphKind } from '@/components/ui/Glyph';

/**
 * Homepage category strip. Routes into the printer results list rather than a configurator —
 * under V2 the customer picks a printer before they pick a spec.
 */
export function HotProducts() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <h2 className="font-display text-3xl font-extrabold tracking-tight text-black">
        What are you printing?
      </h2>
      <p className="mt-1.5 text-black/60">Pick a category and see printers near you who do it.</p>

      <ul className="mt-6 grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-4">
        {BROWSABLE_CATEGORIES.map((c) => {
          const soon = c.status !== 'live';
          const body = (
            <>
              <Glyph kind={c.glyph as GlyphKind} color={c.hue} className="size-12" />
              <div>
                <h3 className="font-display text-[15px] font-extrabold tracking-tight text-navy">{c.name}</h3>
                <p className="mt-0.5 text-[13px] text-black/55">{c.blurb}</p>
              </div>
              <span className="mt-auto border-t border-dashed border-black/25 pt-2.5 font-display text-[13px] font-bold text-navy">
                {soon ? 'Coming soon' : <>Find printers <span aria-hidden>→</span></>}
              </span>
            </>
          );

          return (
            <li key={c.slug}>
              {soon ? (
                <div className="flex h-full flex-col gap-3 rounded-2xl border border-dashed border-black/20 bg-white/60 p-5 opacity-70">
                  {body}
                </div>
              ) : (
                <Link href={`/printers?category=${c.slug}`}
                  className="group flex h-full flex-col gap-3 rounded-2xl border border-black/12 bg-white p-5 transition-all hover:-translate-y-0.5 hover:border-blue">
                  {body}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
