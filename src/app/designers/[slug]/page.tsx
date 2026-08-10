import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import { getPublicStudio, studioWorks, studioServices } from '@/lib/designers';
import { naira } from '@/lib/format';
import Link from 'next/link';
import { CodeBadge } from '@/components/ui/CodeBadge';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const studio = await getPublicStudio((await params).slug);
  if (!studio) return {};
  return {
    title: studio.displayName,
    description: studio.tagline ?? `Design work by ${studio.displayName} on PrintRuns.`,
  };
}

export default async function StudioProfile({ params }: { params: Promise<{ slug: string }> }) {
  const studio = await getPublicStudio((await params).slug);
  if (!studio) notFound();

  const [works, services] = await Promise.all([studioWorks(studio.id), studioServices(studio.id)]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <div className="relative aspect-[4/1] overflow-hidden rounded-2xl bg-pale/40">
        {studio.bannerUrl && <Image src={studio.bannerUrl} alt="" fill sizes="960px" className="object-cover" priority />}
      </div>

      <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          {studio.avatarUrl && (
            <div className="relative size-16 overflow-hidden rounded-pill border border-black/12">
              <Image src={studio.avatarUrl} alt={studio.displayName} fill sizes="64px" className="object-cover" />
            </div>
          )}
          <div>
            <h1 className="font-display text-3xl font-extrabold tracking-tight text-black">{studio.displayName}</h1>
            {studio.tagline && <p className="mt-0.5 text-black/60">{studio.tagline}</p>}
          </div>
        </div>
        <CodeBadge code={studio.code} tone="light" />
      </div>

      {studio.bio && <p className="mt-5 max-w-2xl whitespace-pre-line text-[15px] leading-relaxed text-black/70">{studio.bio}</p>}

      {works.length > 0 && (
        <>
          <h2 className="mt-9 font-display text-xl font-extrabold text-navy">Work</h2>
          <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {works.map((w) => (
              <li key={w.id} className="relative aspect-square overflow-hidden rounded-xl border border-black/12">
                <Image src={w.imageUrl} alt={w.caption ?? ''} fill sizes="300px" className="object-cover" />
              </li>
            ))}
          </ul>
        </>
      )}

      <h2 className="mt-9 font-display text-xl font-extrabold text-navy">Services</h2>
      <ul className="mt-3 grid gap-3 sm:grid-cols-2">
        {services.map((s) => (
          <li key={s.id} className="rounded-2xl border border-black/12 bg-white p-5">
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="font-display text-[17px] font-extrabold text-navy">{s.title}</h3>
              <span className="font-display font-extrabold text-navy">{naira(s.priceKobo)}</span>
            </div>
            {s.description && <p className="mt-1.5 text-[14px] leading-relaxed text-black/65">{s.description}</p>}
            <dl className="mt-3 border-t border-dashed border-black/20 pt-2.5 font-mono text-[12px] text-black/55">
              <div className="flex justify-between py-0.5">
                <dt>Revisions included</dt><dd className="font-bold text-navy">{s.revisionsIncluded}</dd>
              </div>
              {s.extraRevisionKobo > 0 && (
                <div className="flex justify-between py-0.5">
                  <dt>Extra revision</dt><dd className="font-bold text-navy">{naira(s.extraRevisionKobo)}</dd>
                </div>
              )}
              <div className="flex justify-between py-0.5">
                <dt>Turnaround</dt><dd className="font-bold text-navy">{s.turnaroundHours}h</dd>
              </div>
            </dl>
            <Link href={`/design/book?service=${s.id}`}
              className="mt-3 block rounded-pill bg-blue px-4 py-2.5 text-center font-display text-[13px] font-bold text-white hover:bg-navy">
              Book this service <span aria-hidden>→</span>
            </Link>
          </li>
        ))}
      </ul>

      <p className="mt-6 rounded-xl border border-dashed border-black/25 bg-pale/25 px-4 py-3 text-[13px] text-black/60">
        Your payment is held by PrintRuns until the design is finished, and you choose whether to
        review it before it goes to print.
      </p>
    </div>
  );
}
