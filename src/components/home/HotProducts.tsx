import Link from 'next/link';
import { CATEGORIES, productCode } from '@/lib/categories';
import { Glyph } from '@/components/ui/Glyph';
import { CodeBadge } from '@/components/ui/CodeBadge';

/** "HOT" stays red — the one sanctioned accent-word use (spec §7.2). */
export function HotProducts() {
  return (
    <section id="products" className="bg-fade-pale">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-20">
        <div className="mb-8">
          <h2 className="font-display text-4xl font-extrabold tracking-tight text-black sm:text-5xl">
            <span className="text-red">Hot</span> Products
          </h2>
          <p className="mt-2 text-black/60">Most-printed this week. Tap one to start a job.</p>
        </div>

        <ul className="grid grid-cols-2 gap-3.5 sm:gap-5 lg:grid-cols-4">
          {CATEGORIES.map((c) => (
            <li key={c.slug}>
              {c.live ? (
                <Link
                  href={`/configure/${c.slug}`}
                  className="group flex h-full flex-col overflow-hidden rounded-2xl border border-black/12 bg-white transition-all hover:-translate-y-0.5 hover:border-blue hover:shadow-[0_10px_30px_-12px_rgba(0,0,255,0.25)]"
                >
                  <div className="relative grid aspect-[1.25/1] place-items-center border-b border-black/10 bg-white p-5">
                    <Glyph kind={c.glyph} color={c.hue} className="size-16 sm:size-20" />
                    <span className="absolute right-2.5 top-2.5"><CodeBadge code={productCode(c.slug)} /></span>
                  </div>
                  <div className="flex flex-1 flex-col gap-2.5 p-4">
                    <h3 className="font-display text-lg font-extrabold tracking-tight text-navy">{c.name}</h3>
                    <div className="flex flex-wrap gap-1.5">
                      <span className="rounded-pill bg-blue px-2.5 py-1 font-mono text-[9px] font-bold uppercase tracking-wider text-white">
                        Ready in {c.turnaround}
                      </span>
                      {c.moq && (
                        <span className="rounded-pill border border-black/20 px-2.5 py-1 font-mono text-[9px] font-bold uppercase tracking-wider text-navy">
                          MOQ {c.moq}
                        </span>
                      )}
                    </div>
                    <span className="mt-auto border-t border-dashed border-black/25 pt-2.5 font-display text-[13px] font-bold text-navy transition-colors group-hover:text-blue">
                      Print now <span aria-hidden>→</span>
                    </span>
                  </div>
                </Link>
              ) : (
                <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-dashed border-black/20 bg-white/60">
                  <div className="relative grid aspect-[1.25/1] place-items-center border-b border-dashed border-black/15 p-5 opacity-45">
                    <Glyph kind={c.glyph} color={c.hue} className="size-16 sm:size-20" />
                    <span className="absolute right-2.5 top-2.5"><CodeBadge code={productCode(c.slug)} tone="light" /></span>
                  </div>
                  <div className="flex flex-1 flex-col gap-2.5 p-4">
                    <h3 className="font-display text-lg font-extrabold tracking-tight text-navy/60">{c.name}</h3>
                    <span className="mt-auto border-t border-dashed border-black/20 pt-2.5 font-mono text-[10px] font-bold uppercase tracking-widest text-navy/50">
                      Coming soon
                    </span>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
