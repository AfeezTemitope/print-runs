import type { Metadata } from 'next';
import { pendingQueue, CHECKLIST } from '@/lib/preflight';
import { EmptyState } from '@/components/ui/EmptyState';
import { ReviewCard, type QueueItem } from './ReviewCard';

export const metadata: Metadata = { title: 'Preflight' };

export default async function AdminPreflightPage() {
  const rows = await pendingQueue();

  const items: QueueItem[] = rows.map(({ review, order, shop }) => ({
    reviewId: review.id,
    round: review.round,
    orderCode: order.code,
    submittedAt: review.submittedAt.toISOString(),
    fileUrl: review.fileUrl,
    fileName: review.fileName,
    listingName: order.spec?.listingName ?? 'Order',
    specLine: order.spec?.width && order.spec?.height
      ? `${order.spec.width} × ${order.spec.height} ${order.spec.unit ?? ''}`
      : `${(order.spec?.qty ?? 1).toLocaleString()} pcs`,
    printerName: shop?.businessName ?? 'a printer',
    waitingHours: Math.floor((Date.now() - review.submittedAt.getTime()) / 3_600_000),
  }));

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-black">Preflight</h1>
        <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-black/45">
          {items.length > 0 ? `${items.length} awaiting review` : 'queue clear'}
        </p>
      </div>
      <p className="mt-2 max-w-2xl text-black/60">
        These orders are paused and invisible to their printers until you pass them. Target is
        within 1–2 hours. You&apos;re answering one question: is this file technically printable?
        Not whether the design is any good.
      </p>

      {!items.length ? (
        <div className="mt-6"><EmptyState title="Nothing waiting" hint="Files appear here when a customer asks for a check." /></div>
      ) : (
        <ul className="mt-6 space-y-3">{items.map((i) => <ReviewCard key={i.reviewId} item={i} />)}</ul>
      )}

      <details className="mt-8 rounded-2xl border border-black/12 bg-white p-4">
        <summary className="cursor-pointer font-display text-[15px] font-extrabold text-navy">
          The V1 checklist
        </summary>
        <ul className="mt-3 space-y-3">
          {CHECKLIST.map((c) => (
            <li key={c.key}>
              <p className="font-display text-[13px] font-bold text-navy">{c.label}</p>
              <p className="text-[13px] text-black/65">{c.reviews}</p>
              <p className="mt-0.5 text-xs text-black/45">{c.examples}</p>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-black/50">
          Not checked in V1: bleed and trim marks, missing fonts, transparency and overprint.
          These are added to the checklist later without a rebuild.
        </p>
      </details>
    </div>
  );
}
