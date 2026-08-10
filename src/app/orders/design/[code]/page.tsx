import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import Image from 'next/image';
import { and, desc, eq } from 'drizzle-orm';
import { db, tables } from '@/db';
import { getSession } from '@/lib/auth';
import { naira, shortDate } from '@/lib/format';
import { freeRevisionsLeft, unconsumedPaidRevisions } from '@/lib/design-orders';
import { CodeBadge } from '@/components/ui/CodeBadge';
import { ProofReview } from './ProofReview';

export const metadata: Metadata = { title: 'Design order' };

const STAGE: Record<string, string> = {
  brief_received: 'Brief received',
  in_progress: 'Designer is working',
  proof_ready: 'Waiting on your review',
  revision_requested: 'Changes requested',
  approved: 'Approved',
  cancelled: 'Cancelled',
};

export default async function DesignOrderPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const session = await getSession();
  if (!session) redirect(`/login?next=/orders/design/${code}`);

  const [order] = await db().select().from(tables.designOrders)
    .where(and(eq(tables.designOrders.code, code), eq(tables.designOrders.customerId, session.uid)))
    .limit(1);
  if (!order) notFound();

  const [studio] = await db().select().from(tables.designerStudios)
    .where(eq(tables.designerStudios.id, order.studioId)).limit(1);

  const proofs = await db().select().from(tables.designProofs)
    .where(eq(tables.designProofs.designOrderId, order.id))
    .orderBy(desc(tables.designProofs.round));

  const paid = await unconsumedPaidRevisions(order.id);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-black">{order.serviceTitle}</h1>
          <p className="mt-1 text-black/60">
            {studio?.displayName ?? 'Your designer'} · {shortDate(order.createdAt)}
          </p>
        </div>
        <CodeBadge code={order.code} tone="light" />
      </div>

      <p className="mt-4 inline-block rounded-pill bg-navy px-3.5 py-1.5 font-mono text-[11px] font-bold uppercase tracking-widest text-pale">
        {STAGE[order.status] ?? order.status}
      </p>

      <dl className="mt-5 rounded-2xl border border-black/12 bg-white p-5 font-mono text-[13px]">
        <div className="flex justify-between border-b border-dashed border-black/20 py-2.5">
          <dt className="text-black/55">Design fee</dt>
          <dd className="font-bold text-navy">{naira(order.designerBaseKobo)}</dd>
        </div>
        <div className="flex justify-between border-b border-dashed border-black/20 py-2.5">
          <dt className="text-black/55">Platform</dt>
          <dd className="font-bold text-navy">{naira(order.marginKobo + order.platformFeeKobo)}</dd>
        </div>
        <div className="flex justify-between py-2.5">
          <dt className="text-black/55">Paid</dt>
          <dd className="font-display text-lg font-extrabold text-navy">{naira(order.amountPaidKobo)}</dd>
        </div>
      </dl>

      <ProofReview
        orderId={order.id}
        status={order.status}
        reviewMode={order.reviewMode}
        freeLeft={freeRevisionsLeft(order)}
        paidUnconsumed={paid.length}
        extraRevisionKobo={order.extraRevisionKobo}
        latestProof={proofs[0] ? { round: proofs[0].round, fileUrl: proofs[0].fileUrl, note: proofs[0].note } : null}
      />

      {order.status === 'approved' && order.finalFileUrl && (
        <section className="mt-6 rounded-2xl border border-success/40 bg-success/5 p-5">
          <p className="font-display font-extrabold text-navy">Your design is ready</p>
          <p className="mt-1 text-[14px] text-black/70">
            Approved {order.approvedAt ? shortDate(order.approvedAt) : ''}. Download it, or use it on a print order.
          </p>
          <a href={order.finalFileUrl} target="_blank" rel="noreferrer"
            className="mt-3 inline-block rounded-pill bg-blue px-5 py-2.5 font-display text-sm font-bold text-white">
            Download final design
          </a>
        </section>
      )}

      {proofs.length > 1 && (
        <>
          <h2 className="mt-8 font-display text-lg font-extrabold text-navy">Earlier proofs</h2>
          <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {proofs.slice(1).map((p) => (
              <li key={p.id}>
                <div className="relative aspect-square overflow-hidden rounded-xl border border-black/12 bg-pale/30">
                  <Image src={p.fileUrl} alt={`Proof ${p.round}`} fill sizes="240px" className="object-contain" />
                </div>
                <p className="mt-1 font-mono text-[10px] font-bold uppercase tracking-widest text-black/45">
                  Proof {p.round}
                </p>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
