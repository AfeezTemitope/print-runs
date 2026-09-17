import type { Metadata } from 'next';
import { desc, eq, isNotNull, or } from 'drizzle-orm';
import { db, tables } from '@/db';
import { openDisputes, lostDisputeCount, standingFor, PRINTER_RESPONSE_HOURS } from '@/lib/trust';
import { shortDate } from '@/lib/format';
import { CodeBadge } from '@/components/ui/CodeBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { DisputeCard, type DisputeItem } from './DisputeCard';
import { FlaggedReviews, type FlaggedReview } from './FlaggedReviews';

export const metadata: Metadata = { title: 'Disputes' };

const REASON_LABEL: Record<string, string> = {
  not_delivered: 'Job not delivered',
  wrong_product: 'Wrong product or size',
  quality: 'Print quality unacceptable',
  damaged: 'Damaged on delivery',
  other: 'Other',
};

export default async function AdminDisputesPage() {
  const rows = await openDisputes();

  const standings = new Map<string, Awaited<ReturnType<typeof standingFor>>>();
  for (const shopId of new Set(rows.map((r) => r.dispute.shopId))) {
    standings.set(shopId, standingFor(await lostDisputeCount(shopId)));
  }

  const items: DisputeItem[] = rows.map(({ dispute, order, shop }) => ({
    id: dispute.id,
    orderCode: order.code,
    createdAt: dispute.createdAt.toISOString(),
    reasonLabel: REASON_LABEL[dispute.reason] ?? dispute.reason,
    detail: dispute.detail,
    evidenceUrls: dispute.evidenceUrls ?? [],
    printerName: shop?.businessName ?? 'Unknown printer',
    printerResponse: dispute.printerResponse,
    printerRespondedAt: dispute.printerRespondedAt ? dispute.printerRespondedAt.toISOString() : null,
    state: dispute.state,
    outcome: dispute.outcome,
    decisionNote: dispute.decisionNote,
    // §4.4: the override record is strong evidence in the printer's favour on quality.
    preflightOverridden: Boolean(order.preflightOverriddenAt),
    amountPaidKobo: order.amountPaidKobo ?? 0,
    standing: standings.get(dispute.shopId)?.message ?? '',
    hoursForResponse: PRINTER_RESPONSE_HOURS,
  }));

  const open = items.filter((i) => !i.outcome);

  const flaggedRows = await db()
    .select({ review: tables.reviews, shop: tables.shops })
    .from(tables.reviews)
    .leftJoin(tables.shops, eq(tables.reviews.shopId, tables.shops.id))
    .where(or(isNotNull(tables.reviews.flaggedAt), isNotNull(tables.reviews.removedAt)))
    .orderBy(desc(tables.reviews.flaggedAt))
    .limit(50);

  const flagged: FlaggedReview[] = flaggedRows.map(({ review, shop }) => ({
    id: review.id,
    rating: review.rating,
    comment: review.comment,
    flagReason: review.flagReason,
    printerName: shop?.businessName ?? 'Unknown printer',
    removed: Boolean(review.removedAt),
    removedReason: review.removedReason,
  }));

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-black">Disputes</h1>
        <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-black/45">
          {open.length > 0 ? `${open.length} awaiting decision` : 'nothing open'}
        </p>
      </div>
      <p className="mt-2 max-w-2xl text-black/60">
        Settlement is frozen on every open dispute. A job that was never delivered is always
        resolved in the customer&apos;s favour; everything else is a judgement call on the evidence.
      </p>

      {!items.length ? (
        <div className="mt-6"><EmptyState title="No disputes" hint="They appear here when a customer raises one within 48 hours of delivery." /></div>
      ) : (
        <ul className="mt-6 space-y-3">{items.map((i) => <DisputeCard key={i.id} item={i} />)}</ul>
      )}

      {flagged.length > 0 && (
        <>
          <h2 className="mt-9 font-display text-lg font-extrabold text-navy">Flagged reviews</h2>
          <p className="mt-1 max-w-2xl text-[13px] text-black/55">
            A printer disagreeing with a review is not a reason to remove it. Abuse, personal
            information or a demonstrably fake review is.
          </p>
          <FlaggedReviews reviews={flagged} />
        </>
      )}
    </div>
  );
}
