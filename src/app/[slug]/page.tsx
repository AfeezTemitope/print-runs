import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { and, eq } from 'drizzle-orm';
import { db, tables } from '@/db';
import { getCategory, isReservedSlug } from '@/lib/catalog';
import { fromPriceKobo } from '@/lib/listing-pricing';
import { listingsFor, subcategoriesFor, tiersForListings } from '@/lib/storefront';
import { naira } from '@/lib/format';
import { CodeBadge } from '@/components/ui/CodeBadge';
import { PortfolioStrip } from '@/components/discovery/PortfolioStrip';

/** Accepts @handle, a bare handle, or a full URL — printers type all three. */
function instagramUrl(value: string): string {
  const v = value.trim();
  if (/^https?:\/\//i.test(v)) return v;
  return `https://instagram.com/${v.replace(/^@/, '')}`;
}

/**
 * Public storefront at printruns.ng/[slug] (Module 1, Section 7).
 *
 * This is a catch-all at the root, so it runs for any path that no other route claimed. It
 * must therefore refuse reserved words itself — matching the check at signup — or a stale
 * link to a removed page would render as a missing printer instead of a 404.
 */

async function loadShop(slug: string) {
  if (isReservedSlug(slug)) return null;
  const [shop] = await db().select().from(tables.shops)
    .where(and(eq(tables.shops.slug, slug), eq(tables.shops.isActive, true))).limit(1);
  return shop ?? null;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const shop = await loadShop((await params).slug);
  if (!shop) return {};
  return {
    title: shop.businessName,
    description: shop.bio ?? `${shop.businessName} — printing in ${shop.addressCity ?? 'Lagos'}. Order online with PrintRuns.`,
  };
}

export default async function StorefrontPage({
  params, searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const shop = await loadShop((await params).slug);
  if (!shop) notFound();

  const raw = (await searchParams).category;
  // Deep link from a category search lands on that category's listings only (Module 2 §3.4).
  const focus = Array.isArray(raw) ? raw[0] : raw;

  const [subs, allListings] = await Promise.all([
    subcategoriesFor(shop.id),
    listingsFor(shop.id, true),
  ]);
  const tierMap = await tiersForListings(allListings.map((l) => l.id));

  const listings = focus ? allListings.filter((l) => l.categorySlug === focus) : allListings;
  const focusCategory = focus ? getCategory(focus) : undefined;

  // The portfolio is generated from listing photos — no separate upload (Section 7).
  const portfolio = allListings.flatMap((l) => l.photos ?? []).slice(0, 24);

  const subName = new Map(subs.map((s) => [s.id, s.name]));
  const grouped = new Map<string, typeof listings>();
  for (const l of listings) {
    const key = l.subcategoryId ? subName.get(l.subcategoryId) ?? 'Other' : 'Other';
    grouped.set(key, [...(grouped.get(key) ?? []), l]);
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="relative aspect-[4/1] overflow-hidden rounded-2xl bg-pale/40">
        {shop.bannerUrl && <Image src={shop.bannerUrl} alt="" fill sizes="960px" className="object-cover" priority />}
      </div>

      <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          {shop.logoUrl && (
            <div className="relative size-16 shrink-0 overflow-hidden rounded-pill border border-black/12">
              <Image src={shop.logoUrl} alt={shop.businessName} fill sizes="64px" className="object-cover" />
            </div>
          )}
          <div>
            <h1 className="font-display text-3xl font-extrabold tracking-tight text-black">{shop.businessName}</h1>
            <p className="mt-0.5 text-[13px] text-black/55">
              {[shop.addressCity, shop.addressState].filter(Boolean).join(', ')}
              {shop.ratingCount > 0 && ` · ★ ${shop.ratingAvg.toFixed(1)} (${shop.ratingCount})`}
            </p>
            {/*
              Item #12b: the WhatsApp number is NOT shown publicly. Displaying it invited
              customers to take the conversation — and the payment — off the platform, which
              removes every protection the order flow exists to provide. Ops still has it.
            */}
            {shop.instagram && (
              <a href={instagramUrl(shop.instagram)} target="_blank" rel="noreferrer"
                className="mt-1 inline-block font-display text-[13px] font-bold text-blue hover:underline">
                {shop.instagram.replace(/^@/, '@')}
              </a>
            )}
          </div>
        </div>
        <CodeBadge code={shop.code} tone="light" />
      </div>

      {shop.bio && <p className="mt-4 max-w-2xl whitespace-pre-line text-[15px] leading-relaxed text-black/70">{shop.bio}</p>}

      <PortfolioStrip photos={portfolio} shopName={shop.businessName} />

      <div className="mt-8 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-lg font-extrabold text-navy">
          {focusCategory ? focusCategory.name : 'Products'}
        </h2>
        {focus && (
          <Link href={`/${shop.slug}`} className="font-display text-[13px] font-bold text-black/45 hover:text-blue">
            See all products from this printer →
          </Link>
        )}
      </div>

      {!listings.length ? (
        <p className="mt-3 rounded-2xl border border-dashed border-black/20 bg-white/60 px-5 py-8 text-center text-black/55">
          Nothing listed here yet.
        </p>
      ) : (
        [...grouped.entries()].map(([group, items]) => (
          <section key={group} className="mt-5">
            {grouped.size > 1 && (
              <p className="mb-2 font-mono text-[10px] font-bold uppercase tracking-widest text-black/45">{group}</p>
            )}
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((l) => {
                const from = fromPriceKobo(l, tierMap.get(l.id) ?? []);
                return (
                  <li key={l.id}>
                    <Link href={`/${shop.slug}/${l.id}`}
                      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-black/12 bg-white transition-all hover:-translate-y-0.5 hover:border-blue">
                      <div className="relative aspect-[4/3] bg-pale/30">
                        {l.photos?.[0] && <Image src={l.photos[0]} alt={l.name} fill sizes="300px" className="object-cover" />}
                      </div>
                      <div className="flex flex-1 flex-col gap-1.5 p-4">
                        <h3 className="font-display text-[15px] font-extrabold leading-tight text-navy">{l.name}</h3>
                        {l.description && <p className="line-clamp-2 text-[13px] text-black/55">{l.description}</p>}
                        <p className="mt-auto pt-2 font-display text-sm font-extrabold text-navy">
                          {from !== null ? `From ${naira(from)}` : 'Request quote'}
                          {l.minimumOrder ? <span className="ml-1.5 font-mono text-[11px] font-bold text-black/45">Min. {l.minimumOrder}</span> : null}
                        </p>
                        <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-black/40">
                          {l.turnaroundHours}hr turnaround
                        </p>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
