import type { Metadata } from 'next';
import Link from 'next/link';
import { desc, eq } from 'drizzle-orm';
import { db, tables } from '@/db';
import { getSession } from '@/lib/auth';
import { getCategory } from '@/lib/categories';
import { EmptyState } from '@/components/ui/EmptyState';
import { QuoteActions } from './quote/QuoteActions';
import { PreflightPanel } from './preflight/PreflightPanel';
import { latestReview } from '@/lib/preflight';
import { ButtonLink } from '@/components/ui/Button';
import { naira, shortDate } from '@/lib/format';
import { statusLabel } from '@/lib/status';

export const metadata: Metadata = { title: 'My orders' };
export const dynamic = 'force-dynamic';

// V2: 7 stages (decision 18) rather than V1's 3.
const BADGE: Record<string, string> = {
  order_received: 'bg-pale text-navy',
  printer_assigned: 'bg-pale text-navy',
  printing_in_progress: 'bg-blue text-white',
  printing_completed: 'bg-blue text-white',
  ready_for_dispatch: 'bg-navy text-pale',
  out_for_delivery: 'bg-navy text-pale',
  delivered: 'bg-success/15 text-success',
  cancelled: 'bg-red/10 text-red',
};

// Design orders run their own lifecycle, so they need their own labels rather than being
// forced through statusLabel(), which only knows about print stages.
const DESIGN_LABEL: Record<string, string> = {
  brief_received: 'Brief received',
  in_progress: 'Designer working',
  proof_ready: 'Your review needed',
  revision_requested: 'Changes requested',
  approved: 'Design ready',
  cancelled: 'Cancelled',
};

const DESIGN_BADGE: Record<string, string> = {
  brief_received: 'bg-pale text-navy',
  in_progress: 'bg-blue text-white',
  proof_ready: 'bg-red text-white',
  revision_requested: 'bg-blue text-white',
  approved: 'bg-success/15 text-success',
  cancelled: 'bg-red/10 text-red',
};

/** Screen 8 (spec §3): same status data as Track Order, different view. */
export default async function OrdersPage() {
  const session = (await getSession())!;
  const [rows, designRows] = await Promise.all([
    db().select({
      order: tables.orders,
      shopName: tables.shops.businessName,
    })
      .from(tables.orders)
      .innerJoin(tables.shops, eq(tables.orders.shopId, tables.shops.id))
      .where(eq(tables.orders.customerId, session.uid))
      .orderBy(desc(tables.orders.createdAt)),
    db().select({
      order: tables.designOrders,
      studioName: tables.designerStudios.displayName,
    })
      .from(tables.designOrders)
      .leftJoin(tables.designerStudios, eq(tables.designOrders.studioId, tables.designerStudios.id))
      .where(eq(tables.designOrders.customerId, session.uid))
      .orderBy(desc(tables.designOrders.createdAt)),
  ]);

  // Paused orders need their latest review to render the right panel; fetched once here
  // rather than per row.
  const paused = rows.filter((r) => r.order.status === 'paused');
  const reviews = new Map(
    (await Promise.all(paused.map(async (r) => [r.order.id, await latestReview(r.order.id)] as const)))
      .filter((e): e is [string, NonNullable<Awaited<ReturnType<typeof latestReview>>>] => Boolean(e[1])),
  );

  // Print and design jobs interleave by date. A customer thinks in terms of "things I ordered",
  // not in terms of which table they landed in.
  type Row =
    | { kind: 'print'; at: Date; order: (typeof rows)[number]['order']; shopName: string }
    | { kind: 'design'; at: Date; order: (typeof designRows)[number]['order']; studioName: string | null };

  const merged: Row[] = [
    ...rows.map((r) => ({ kind: 'print' as const, at: r.order.createdAt, order: r.order, shopName: r.shopName })),
    ...designRows.map((r) => ({ kind: 'design' as const, at: r.order.createdAt, order: r.order, studioName: r.studioName })),
  ].sort((a, b) => b.at.getTime() - a.at.getTime());

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="font-display text-4xl font-extrabold tracking-tight text-black">
        My <span className="text-blue">orders</span>
      </h1>

      {merged.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            title="No orders yet"
            hint="Your past and active print jobs will live here."
            action={<ButtonLink href="/products">Start printing</ButtonLink>}
          />
        </div>
      ) : (
        <ul className="mt-8 divide-y divide-dashed divide-black/15 rounded-2xl border border-black/12 bg-white">
          {merged.map((row) => {
            if (row.kind === 'design') {
              const o = row.order;
              return (
                <li key={o.id}>
                  <Link href={`/orders/design/${o.code}`} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 transition-colors hover:bg-pale/20">
                    <div>
                      <p className="font-display font-extrabold text-navy">
                        {o.serviceTitle}
                        <span className="ml-2 font-mono text-xs font-bold text-black/45">{o.code}</span>
                      </p>
                      <p className="mt-0.5 text-[13px] text-black/50">
                        {row.studioName ?? 'Designer'} · {shortDate(o.createdAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`rounded-pill px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-widest ${DESIGN_BADGE[o.status] ?? 'bg-pale text-navy'}`}>
                        {DESIGN_LABEL[o.status] ?? o.status}
                      </span>
                      <span className="font-display font-extrabold text-navy">{naira(o.amountPaidKobo)}</span>
                    </div>
                  </Link>
                </li>
              );
            }
            const { order, shopName } = row;
            // A paused order is waiting on us, not on the printer — it needs the file-review
            // panel rather than a status row the customer can do nothing with.
            const review = reviews.get(order.id);
            if (order.status === 'paused' && review) {
              return (
                <li key={order.id} className="px-5 py-4">
                  <p className="font-display font-extrabold text-navy">
                    {order.spec?.listingName ?? 'Your order'}
                    <span className="ml-2 font-mono text-xs font-bold text-black/45">{order.code}</span>
                  </p>
                  <p className="mt-0.5 text-[13px] text-black/50">{shopName} · {shortDate(order.createdAt)}</p>
                  <PreflightPanel state={{
                    orderId: order.id,
                    reviewStatus: review.status === 'failed' ? 'failed' : 'pending',
                    issues: (review.findings ?? []).map((f) => f.note),
                    reviewerNote: review.reviewerNote,
                    round: review.round,
                  }} />
                </li>
              );
            }
            // A quote the printer has answered needs a decision from the customer, so it gets
            // its own block rather than being another row in a list they might scroll past.
            if (order.quotedPriceKobo && order.paymentStatus !== 'paid' && order.status !== 'cancelled') {
              return (
                <li key={order.id} className="px-5 py-4">
                  <p className="font-display font-extrabold text-navy">
                    {order.spec?.listingName ?? 'Custom job'}
                    <span className="ml-2 font-mono text-xs font-bold text-black/45">{order.code}</span>
                  </p>
                  <p className="mt-0.5 text-[13px] text-black/50">{shopName} · {shortDate(order.createdAt)}</p>
                  <QuoteActions
                    orderId={order.id}
                    quotedPriceKobo={order.quotedPriceKobo}
                    note={order.quoteNote}
                    printer={shopName}
                  />
                </li>
              );
            }
            const isPendingQuote = order.isQuote && order.paymentStatus === 'unpaid';
            const label = isPendingQuote
              ? 'Quote requested'
              : statusLabel(order.status, order.fulfillmentMethod);
            return (
              <li key={order.id}>
                <Link href={`/orders/${order.id}`} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 transition-colors hover:bg-pale/20">
                  <div>
                    <p className="font-display font-extrabold text-navy">
                      {getCategory(order.spec.category)?.name ?? order.spec.category}
                      <span className="ml-2 font-mono text-xs font-bold text-black/45">{order.code}</span>
                    </p>
                    <p className="mt-0.5 text-[13px] text-black/50">{shopName} · {shortDate(order.createdAt)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`rounded-pill px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-widest ${BADGE[isPendingQuote ? 'order_received' : order.status]}`}>
                      {label}
                    </span>
                    {/* amountPaidKobo is what the customer actually paid at checkout
                        (selling price + platform fee). Delivery is quoted separately. */}
                    <span className="font-display font-extrabold text-navy">{naira(order.amountPaidKobo)}</span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
