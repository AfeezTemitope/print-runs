import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { desc, eq, sql } from 'drizzle-orm';
import { db, tables } from '@/db';
import { getSession } from '@/lib/auth';
import { getMyStudio } from '@/lib/designers';
import { EmptyState } from '@/components/ui/EmptyState';
import { JobCard, type Job } from './JobCard';

export const metadata: Metadata = { title: 'Briefs' };

export default async function StudioJobsPage() {
  const session = await getSession();
  if (!session) redirect('/login?next=/studio/jobs');
  if (session.role !== 'designer' && session.role !== 'admin') redirect('/');

  const studio = await getMyStudio();
  if (!studio) redirect('/studio');

  const rows = await db()
    .select({
      o: tables.designOrders,
      rounds: sql<number>`(select count(*) from ${tables.designProofs} p where p.design_order_id = ${tables.designOrders.id})`,
      note: sql<string | null>`(select p.revision_note from ${tables.designProofs} p
        where p.design_order_id = ${tables.designOrders.id} order by p.round desc limit 1)`,
    })
    .from(tables.designOrders)
    .where(eq(tables.designOrders.studioId, studio.id))
    .orderBy(desc(tables.designOrders.createdAt));

  // Anything the designer can act on comes first; approved work sinks to the bottom.
  const rank = (status: string) =>
    status === 'revision_requested' ? 0 : status === 'brief_received' ? 1
      : status === 'in_progress' ? 2 : status === 'proof_ready' ? 3 : 4;

  const jobs: Job[] = rows
    .sort((a, b) => rank(a.o.status) - rank(b.o.status))
    .map(({ o, rounds, note }) => ({
      id: o.id, code: o.code, serviceTitle: o.serviceTitle, status: o.status,
      reviewMode: o.reviewMode, brief: o.brief, briefFileUrl: o.briefFileUrl,
      contactEmail: o.contactEmail, contactPhone: o.contactPhone,
      designerBaseKobo: o.designerBaseKobo,
      revisionsIncluded: o.revisionsIncluded, revisionsUsed: o.revisionsUsed,
      createdAt: o.createdAt.toISOString(), latestRevisionNote: note, rounds: Number(rounds),
    }));

  const open = jobs.filter((j) => j.status !== 'approved' && j.status !== 'cancelled').length;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-black">Briefs</h1>
        <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-black/45">
          {open > 0 ? `${open} open` : 'nothing open'}
        </p>
      </div>

      {!jobs.length ? (
        <div className="mt-6">
          <EmptyState title="No briefs yet" hint="Customers who book you will appear here." />
        </div>
      ) : (
        <ul className="mt-6 space-y-3">{jobs.map((j) => <JobCard key={j.id} job={j} />)}</ul>
      )}
    </div>
  );
}
