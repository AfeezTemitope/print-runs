import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { listPublicStudios, studioServices } from '@/lib/designers';
import { naira } from '@/lib/format';
import { CodeBadge } from '@/components/ui/CodeBadge';
import { EmptyState } from '@/components/ui/EmptyState';

export const metadata: Metadata = {
  title: 'Designers',
  description: 'Work with a verified designer, then print with PrintRuns.',
};

export default async function DesignersPage() {
  const studios = await listPublicStudios();
  const withPricing = await Promise.all(studios.map(async (s) => ({
    studio: s,
    from: (await studioServices(s.id)).reduce<number | null>(
      (min, sv) => (min === null || sv.priceKobo < min ? sv.priceKobo : min), null),
  })));

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 md:py-14">
      <h1 className="font-display text-4xl font-extrabold tracking-tight text-black sm:text-5xl">
        Work with a <span className="text-blue">designer</span>
      </h1>
      <p className="mt-2 max-w-2xl text-black/60">
        Every designer here has been reviewed by PrintRuns. Browse their work, pick the one whose
        style fits, and print the result without leaving the platform.
      </p>

      {!withPricing.length ? (
        <div className="mt-8">
          <EmptyState title="No designers yet" hint="We're reviewing the first applications now." />
        </div>
      ) : (
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {withPricing.map(({ studio, from }) => (
            <li key={studio.id}>
              <Link href={`/designers/${studio.slug}`}
                className="group flex h-full flex-col overflow-hidden rounded-2xl border border-black/12 bg-white transition-all hover:-translate-y-0.5 hover:border-blue">
                <div className="relative aspect-[3/1] bg-pale/40">
                  {studio.bannerUrl && (
                    <Image src={studio.bannerUrl} alt="" fill sizes="400px" className="object-cover" />
                  )}
                </div>
                <div className="flex flex-1 flex-col gap-2 p-5">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="font-display text-lg font-extrabold tracking-tight text-navy">{studio.displayName}</h2>
                    <CodeBadge code={studio.code} tone="light" />
                  </div>
                  {studio.tagline && <p className="text-[13px] text-black/55">{studio.tagline}</p>}
                  <span className="mt-auto border-t border-dashed border-black/25 pt-2.5 font-display text-[13px] font-bold text-navy group-hover:text-blue">
                    {from !== null ? `From ${naira(from)}` : 'View work'} <span aria-hidden>→</span>
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
