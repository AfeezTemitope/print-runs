import type { Metadata } from 'next';
import Link from 'next/link';
import { desc, eq, sql } from 'drizzle-orm';
import { db, tables } from '@/db';
import { shortDate } from '@/lib/format';
import { CodeBadge } from '@/components/ui/CodeBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { ReviewStudio } from './ReviewStudio';

export const metadata: Metadata = { title: 'Designers' };

export default async function AdminDesignersPage() {
  const rows = await db()
    .select({
      studio: tables.designerStudios,
      works: sql<number>`(select count(*) from ${tables.designerWorks} w where w.studio_id = ${tables.designerStudios.id})`,
      services: sql<number>`(select count(*) from ${tables.designerServices} s where s.studio_id = ${tables.designerStudios.id})`,
    })
    .from(tables.designerStudios)
    .orderBy(desc(tables.designerStudios.createdAt))
    .limit(100);

  // Waiting means submitted and not yet looked at — reviewedAt is the marker, not the status.
  const waiting = rows.filter((r) => r.studio.verification === 'pending' && r.studio.reviewedAt === null);
  const rest = rows.filter((r) => !waiting.includes(r));

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-black">Designers</h1>
        <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-black/45">
          {waiting.length > 0 ? `${waiting.length} awaiting review` : 'nothing awaiting review'}
        </p>
      </div>

      {!rows.length ? (
        <div className="mt-6"><EmptyState title="No applications yet" hint="Designers apply from their own studio page." /></div>
      ) : (
        <>
          <ul className="mt-6 space-y-3">
            {waiting.map(({ studio, works, services }) => (
              <li key={studio.id} className="rounded-2xl border border-blue bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-display font-extrabold text-navy">{studio.displayName}</p>
                    <p className="mt-0.5 text-[13px] text-black/55">
                      {works} portfolio pieces · {services} services · applied {shortDate(studio.createdAt)}
                    </p>
                    <Link href={`/designers/${studio.slug}`} target="_blank"
                      className="mt-1 inline-block font-display text-[13px] font-bold text-blue underline">
                      Preview their profile →
                    </Link>
                  </div>
                  <CodeBadge code={studio.code} tone="light" />
                </div>
                <ReviewStudio id={studio.id} />
              </li>
            ))}
          </ul>

          {rest.length > 0 && (
            <>
              <h2 className="mt-8 font-display text-lg font-extrabold text-navy">Reviewed</h2>
              <ul className="mt-3 space-y-2">
                {rest.map(({ studio }) => (
                  <li key={studio.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-black/12 bg-white px-4 py-3">
                    <span className="text-[13px] text-navy">
                      <strong className="font-display font-extrabold">{studio.displayName}</strong>
                      {studio.verificationNote ? ` · ${studio.verificationNote}` : ''}
                    </span>
                    <span className={`font-mono text-[10px] font-bold uppercase tracking-widest ${
                      studio.verification === 'verified' ? 'text-success' : 'text-red'
                    }`}>
                      {studio.verification}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </div>
  );
}
