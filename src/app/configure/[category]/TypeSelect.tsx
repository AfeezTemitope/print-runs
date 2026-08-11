import Link from 'next/link';
import type { Category } from '@/lib/categories';
import { ProductImage } from '@/components/ui/ProductImage';
import { CodeBadge } from '@/components/ui/CodeBadge';
import { pickPhoto, type PhotoMap } from '@/lib/photos';

/**
 * QA 1.1 — the page that was missing. A category with more than one type lands here first:
 * one photo-led card per type, and only after choosing does the customer reach the
 * configurator. Real photography replaces the glyph panel when it lands (QA 1.8).
 */
export function TypeSelect({
  category, photos, carry = '',
}: { category: Category; photos: PhotoMap; carry?: string }) {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <p className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-blue">Choose a type</p>
      <h1 className="mt-1 font-display text-4xl font-extrabold tracking-tight text-black">{category.name}</h1>
      <p className="mt-2 text-black/60">{category.blurb}</p>

      <ul className={`mt-8 grid gap-4 ${category.listings.length >= 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
        {category.listings.map((l) => (
          <li key={l.slug}>
            <Link
              href={`/configure/${category.slug}/${l.slug}${carry}`}
              className="group flex h-full flex-col overflow-hidden rounded-2xl border border-black/12 bg-white transition-all hover:-translate-y-0.5 hover:border-blue"
            >
              <ProductImage
                url={pickPhoto(photos, category.slug, l.slug)}
                glyph={category.glyph}
                hue={category.hue}
                alt={`${category.name} — ${l.label}`}
                className="aspect-[4/3] bg-pale/40"
                glyphClassName="size-24"
              />
              <div className="flex flex-1 flex-col gap-2 p-5">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-display text-xl font-extrabold tracking-tight text-navy">{l.label}</h2>
                  <CodeBadge code={l.code} tone="light" />
                </div>
                <p className="text-[13px] text-black/55">{l.blurb}</p>
                <span className="mt-auto border-t border-dashed border-black/25 pt-2.5 font-display text-[13px] font-bold text-navy transition-colors group-hover:text-blue">
                  Configure <span aria-hidden>→</span>
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
