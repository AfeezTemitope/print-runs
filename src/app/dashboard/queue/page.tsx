import type { Metadata } from 'next';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { db, tables } from '@/db';
import { getMyShop } from '@/lib/auth';
import { getCategory, listingLabel } from '@/lib/categories';
import { specSummary } from '@/lib/spec';
import { naira } from '@/lib/format';
import { QUEUE_STATUSES, statusLabel } from '@/lib/status';
import { EmptyState } from '@/components/ui/EmptyState';
import { QueueActions } from './QueueActions';

export const metadata: Metadata = { title: 'Job queue' };

/**
 * V2 job queue. Orders now walk 7 stages (decision 18) rather than 3, so the card shows the
 * current stage and QueueActions exposes exactly one valid next step. Self-pickup is gone;
 * a Collection order means the customer is sending their own rider (28 Jul decision).
 */
export default async function QueuePage() {
  const shop = (await getMyShop())!;
  const jobs = await db().select().from(tables.orders).where(and(
    eq(tables.orders.shopId, shop.id),
    inArray(tables.orders.status, QUEUE_STATUSES),
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
                    <p className="mt-0.5 font-mono text-xs text-black/55">{specSummary(job.spec, listingLabel(job.spec.category, job.spec.listing)).join(' · ')}</p>
                    {job.printNote && (
                      <p className="mt-1.5 rounded-lg bg-pale/40 px-2.5 py-1.5 text-xs text-navy">
                        <span className="font-bold">Note:</span> {job.printNote}
                      </p>
                    )}
                    <p className="mt-1.5 text-xs text-black/50">
                      {job.fulfillmentMethod === 'collection'
                        ? 'Customer is collecting — do not dispatch'
                        : `Deliver to: ${job.deliveryAddress ?? '—'}`}
                    </p>
                    <p className="mt-1 text-xs text-black/50">
                      {job.contactPhonePrimary ?? '—'}
                      {job.contactPhoneSecondary ? ` · ${job.contactPhoneSecondary}` : ''}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  {/* The printer sees THEIR price — never the customer's selling price, which
                      includes PrintRuns' commercial margin and is deliberately invisible here. */}
                  <span className="block font-display font-extrabold text-navy">{naira(job.printerBaseKobo)}</span>
                  <span className="mt-0.5 block font-mono text-[10px] uppercase tracking-widest text-blue">
                    {statusLabel(job.status, job.fulfillmentMethod)}
                  </span>
                </div>
              </div>
              <div className="mt-4 border-t border-dashed border-black/25 pt-4">
                <QueueActions
                  orderId={job.id}
                  status={job.status}
                  method={job.fulfillmentMethod}
                  fileUrl={job.designFileUrl}
                  collectorName={job.collectionAuthorizedName}
                  collectorPhone={job.collectionAuthorizedPhone}
                />
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
