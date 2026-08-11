import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { desc, eq } from 'drizzle-orm';
import { db, tables } from '@/db';
import { getSession } from '@/lib/auth';
import { getMyStudio } from '@/lib/designers';
import { naira, shortDate } from '@/lib/format';
import { CodeBadge } from '@/components/ui/CodeBadge';
import { EmptyState } from '@/components/ui/EmptyState';

export const metadata: Metadata = { title: 'Earnings' };

export default async function StudioEarningsPage() {
  const session = await getSession();
  if (!session) redirect('/login?next=/studio/earnings');
  if (session.role !== 'designer' && session.role !== 'admin') redirect('/');

  const studio = await getMyStudio();
  if (!studio) redirect('/studio');

  const orders = await db().select().from(tables.designOrders)
    .where(eq(tables.designOrders.studioId, studio.id))
    .orderBy(desc(tables.designOrders.createdAt));

  // A designer is owed their base price on approval, and nothing before it — that is the
  // moment the customer accepted the work. Paid extra revisions are the customer buying more
  // of the designer's time, so they belong to the designer too once the job lands.
  const approved = orders.filter((o) => o.status === 'approved' && o.paymentStatus === 'paid');
  const settled = approved.filter((o) => o.settlementStatus === 'settled');
  const awaiting = approved.filter((o) => o.settlementStatus === 'pending');
  const inFlight = orders.filter((o) => !['approved', 'cancelled'].includes(o.status));

  const sum = (rows: typeof orders) => rows.reduce((t, o) => t + o.designerBaseKobo, 0);

  const CARDS = [
    { label: 'Awaiting settlement', value: naira(sum(awaiting)), hint: `${awaiting.length} approved job${awaiting.length === 1 ? '' : 's'}` },
    { label: 'Paid out', value: naira(sum(settled)), hint: `${settled.length} settled` },
    { label: 'In progress', value: naira(sum(inFlight)), hint: `${inFlight.length} open brief${inFlight.length === 1 ? '' : 's'}` },
  ];

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <h1 className="font-display text-3xl font-extrabold tracking-tight text-black">Earnings</h1>
      <p className="mt-2 max-w-2xl text-black/60">
        You earn your full listed price — PrintRuns&apos; fee is charged on top to the customer, not
        taken out of your fee. A job is owed to you once the customer approves it.
      </p>

      <ul className="mt-6 grid gap-3 sm:grid-cols-3">
        {CARDS.map((c) => (
          <li key={c.label} className="rounded-2xl border border-black/12 bg-white p-5">
            <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-black/45">{c.label}</p>
            <p className="mt-1 font-display text-2xl font-extrabold text-navy">{c.value}</p>
            <p className="mt-0.5 text-[13px] text-black/55">{c.hint}</p>
          </li>
        ))}
      </ul>

      {!orders.length ? (
        <div className="mt-6"><EmptyState title="No jobs yet" hint="Your earnings appear here once customers book you." /></div>
      ) : (
        <>
          <h2 className="mt-8 font-display text-lg font-extrabold text-navy">All jobs</h2>
          <ul className="mt-3 space-y-2">
            {orders.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-black/12 bg-white px-4 py-3">
                <div>
                  <div className="flex items-center gap-2">
                    <CodeBadge code={o.code} tone="light" />
                    <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-black/45">
                      {shortDate(o.createdAt)}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[13px] text-navy">{o.serviceTitle}</p>
                </div>
                <div className="text-right">
                  <p className="font-display font-extrabold text-navy">{naira(o.designerBaseKobo)}</p>
                  <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-black/45">
                    {o.status === 'approved' ? o.settlementStatus : o.status.replace(/_/g, ' ')}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
