'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

/**
 * Portfolio as a horizontal swipe strip (brief item #4).
 *
 * The auto-portfolio was right; stacking every photo vertically was not — it pushed the
 * products, which are the point of the page, below the fold. Three visible, swipe for the rest,
 * same feel as the product carousel.
 *
 * Scroll-snap does the work on touch, so swiping is native and needs no JS. The arrows are for
 * desktop, where there is no swipe gesture, and are hidden when everything already fits.
 */
export function PortfolioStrip({ photos, shopName }: { photos: string[]; shopName: string }) {
  const strip = useRef<HTMLUListElement>(null);
  const [lightbox, setLightbox] = useState<number | null>(null);

  if (!photos.length) return null;

  function nudge(direction: 1 | -1) {
    const el = strip.current;
    if (!el) return;
    el.scrollBy({ left: direction * el.clientWidth * 0.8, behavior: 'smooth' });
  }

  const scrollable = photos.length > 3;

  return (
    <>
      <div className="mt-8 flex items-baseline justify-between gap-3">
        <h2 className="font-display text-lg font-extrabold text-navy">Portfolio</h2>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-black/40">
            {photos.length} photo{photos.length === 1 ? '' : 's'}
          </span>
          {scrollable && (
            <span className="hidden gap-1 sm:flex">
              <button onClick={() => nudge(-1)} aria-label="Previous photos"
                className="grid size-7 place-items-center rounded-pill border border-black/15 text-navy hover:border-blue hover:text-blue">
                <ChevronLeft className="size-4" />
              </button>
              <button onClick={() => nudge(1)} aria-label="More photos"
                className="grid size-7 place-items-center rounded-pill border border-black/15 text-navy hover:border-blue hover:text-blue">
                <ChevronRight className="size-4" />
              </button>
            </span>
          )}
        </div>
      </div>

      <ul
        ref={strip}
        className="mt-3 flex snap-x snap-mandatory gap-2.5 overflow-x-auto pb-1
                   [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {photos.map((url, i) => (
          <li key={url} className="w-[calc((100%-1.25rem)/3)] shrink-0 snap-start">
            <button onClick={() => setLightbox(i)}
              aria-label={`View photo ${i + 1} of ${photos.length}`}
              className="relative block aspect-square w-full overflow-hidden rounded-xl border border-black/12">
              <Image src={url} alt="" fill sizes="220px" className="object-cover" />
            </button>
          </li>
        ))}
      </ul>

      {lightbox !== null && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`${shopName} portfolio`}
          onClick={() => setLightbox(null)}
        >
          <button onClick={() => setLightbox(null)} aria-label="Close"
            className="absolute right-4 top-4 grid size-9 place-items-center rounded-pill bg-white/90 text-navy">
            <X className="size-5" />
          </button>
          <div className="relative aspect-square w-full max-w-2xl" onClick={(e) => e.stopPropagation()}>
            <Image src={photos[lightbox]} alt="" fill sizes="640px" className="object-contain" />
          </div>
          {photos.length > 1 && (
            <div className="absolute bottom-6 flex items-center gap-4" onClick={(e) => e.stopPropagation()}>
              <button onClick={() => setLightbox((n) => ((n ?? 0) - 1 + photos.length) % photos.length)}
                aria-label="Previous" className="grid size-9 place-items-center rounded-pill bg-white/90 text-navy">
                <ChevronLeft className="size-5" />
              </button>
              <span className="font-mono text-[12px] font-bold text-white">{lightbox + 1} / {photos.length}</span>
              <button onClick={() => setLightbox((n) => ((n ?? 0) + 1) % photos.length)}
                aria-label="Next" className="grid size-9 place-items-center rounded-pill bg-white/90 text-navy">
                <ChevronRight className="size-5" />
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
