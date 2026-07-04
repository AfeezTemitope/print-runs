import type { Metadata } from 'next';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { db, tables } from '@/db';
import { getMyShop } from '@/lib/auth';
import { getCategory } from '@/lib/categories';
import { specSummary } from '@/lib/spec';
import { naira } from '@/lib/format';
import { EmptyState } from '@/components/ui/EmptyState';
import { QueueActions } from './QueueActions';

export const metadata: Metadata = { title: 'Job queue' };

/**
 * Screen 4 + §4.1 (spec): numbered jobs, three buttons.
 * Paid orders arrive here as 'printing'; Button 2 flips to 'ready';
 * Button 3 (Dispatch / Notify — adapts to fulfillment_method) completes,
 * and stays locked until Button 2 has been pressed.
 */
export default async function QueuePage() {
  const shop = (await getMyShop())!;
  const jobs = await db().select().from(tables.orders).where(and(
    eq(tables.orders.shopId, shop.id),
    inArray(tables.orders.status, ['printing', 'ready']),
  )).orderBy(asc(tables.orders.createdAt));

  return (
    <div>
      <h1 className="font-display text-3xl font-extrabold tracking-tight text-black">Job queue</h1>
      <p className="mt-1.5 text-sm text-black/55">Oldest first. Completing a job updates the customer&apos;s tracker instantly.</p>

      {jobs.length === 0 ? (
        <div className="mt-6">
          <EmptyState title="Queue is clear" hint="Paid jobs land here automatically, numbered and ready to print." />
        </div>
      ) : (
        <ol className="mt-6 space-y-4">
          {jobs.map((job, i) => (
            <li key={job.id} className="rounded-2xl border border-black/12 bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex gap-3.5">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-navy font-mono text-sm font-bold text-pale">
                    {i + 1}
                  </span>
                  <div>
                    <p className="font-display font-extrabold text-navy">
                      {getCategory(job.spec.category)?.name ?? job.spec.category}
                      <span className="ml-2 font-mono text-xs font-bold text-black/40">{job.code}</span>
                    </p>
                    <p className="mt-0.5 font-mono text-xs text-black/55">{specSummary(job.spec).join(' · ')}</p>
                    {job.printNote && (
                      <p className="mt-1.5 rounded-lg bg-pale/40 px-2.5 py-1.5 text-xs text-navy">
                        <span className="font-bold">Note:</span> {job.printNote}
                      </p>
                    )}
                    <p className="mt-1.5 text-xs text-black/50">
                      {job.fulfillmentMethod === 'pickup' ? 'Self-pickup' : `Deliver to: ${job.deliveryAddress}`}
                    </p>
                  </div>
                </div>
                <span className="font-display font-extrabold text-navy">{naira(job.priceKobo)}</span>
              </div>
              <div className="mt-4 border-t border-dashed border-black/25 pt-4">
                <QueueActions
                  orderId={job.id}
                  status={job.status}
                  method={job.fulfillmentMethod}
                  fileUrl={job.designFileUrl}
                />
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
