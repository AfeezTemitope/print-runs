import type { Metadata } from 'next';
import { desc, eq } from 'drizzle-orm';
import { db, tables } from '@/db';
import { naira, shortDate } from '@/lib/format';
import { CodeBadge } from '@/components/ui/CodeBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { DesignOps, type DesignOpsOrder } from './DesignOps';

export const metadata: Metadata = { title: 'Design orders' };

const STAGE: Record<string, string> = {
  brief_received: 'Brief received',
  in_progress: 'Designer working',
  proof_ready: 'Waiting on customer',
  revision_requested: 'Changes requested',
  approved: 'Approved',
  cancelled: 'Cancelled',
};

export default async function AdminDesignOrdersPage() {
  const rows = await db()
    .select({ o: tables.designOrders, studio: tables.designerStudios })
    .from(tables.designOrders)
    .leftJoin(tables.designerStudios, eq(tables.designOrders.studioId, tables.designerStudios.id))
    .orderBy(desc(tables.designOrders.createdAt))
    .limit(100);

  const days = (from: Date) => Math.floor((Date.now() - from.getTime()) / 86_400_000);

  // Proofs never auto-approve, so a stalled review is the thing ops must actually act on —
  // it floats to the top, then unpaid approved work, then everything else.
  const rank = (o: typeof rows[number]['o']) =>
    o.status === 'proof_ready' ? 0
      : o.status === 'approved' && o.settlementStatus === 'pending' ? 1 : 2;

  const sorted = [...rows].sort((a, b) => rank(a.o) - rank(b.o));
  const owed = rows.filter((r) => r.o.status === 'approved' && r.o.settlementStatus === 'pending');
  const owedKobo = owed.reduce((t, r) => t + r.o.designerBaseKobo, 0);

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-black">Design orders</h1>
        <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-black/45">
          {owed.length > 0 ? `${naira(owedKobo)} owed to designers` : 'nothing owed'}
        </p>
      </div>

      {!rows.length ? (
        <div className="mt-6"><EmptyState title="No design orders yet" hint="They appear here as soon as a customer books a designer." /></div>
      ) : (
        <ul className="mt-6 space-y-3">
          {sorted.map(({ o, studio }) => (
            <li key={o.id} className={`rounded-2xl border bg-white p-4 ${o.status === 'proof_ready' ? 'border-blue' : 'border-black/12'}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <CodeBadge code={o.code} tone="light" />
                    <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-black/45">
                      {shortDate(o.createdAt)}
                    </span>
                  </div>
                  <p className="mt-1 font-display font-extrabold text-navy">{o.serviceTitle}</p>
                  <p className="mt-0.5 text-xs text-black/55">
                    {studio?.displayName ?? 'Unknown studio'} · {STAGE[o.status] ?? o.status}
                    {o.reviewMode === 'direct' ? ' · direct to print' : ''}
                    {' · '}{o.revisionsUsed}/{o.revisionsIncluded} revisions
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-display font-extrabold text-navy">{naira(o.amountPaidKobo)}</p>
                  <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-black/45">
                    {o.paymentStatus}
                    {o.refundAmountKobo ? ` · refund ${naira(o.refundAmountKobo)}` : ''}
                  </p>
                </div>
              </div>

              <DesignOps order={{
                id: o.id,
                status: o.status,
                settlementStatus: o.settlementStatus,
                amountPaidKobo: o.amountPaidKobo,
                designerBaseKobo: o.designerBaseKobo,
                contactEmail: o.contactEmail,
                contactPhone: o.contactPhone,
                opsNote: o.opsNote,
                studioName: studio?.displayName ?? 'the designer',
                stalledDays: o.status === 'proof_ready' ? days(o.updatedAt) : null,
              } as DesignOpsOrder} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
